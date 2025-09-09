// src/app/App.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";

import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";

import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from "@openai/agents/realtime";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { customerServiceRetailCompanyName } from "@/app/agentConfigs/customerServiceRetail";
import { chatSupervisorCompanyName } from "@/app/agentConfigs/chatSupervisor";
import { pswTutorScenario } from "@/app/agentConfigs/pswTutorAgent";

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import dynamic from "next/dynamic";
// PDF viewer wiring
// Replace your static import of PdfPane with a dynamic one:
const PdfPane = dynamic(() => import("./components/PdfPane"), { ssr: false });
import { PdfNavProvider } from "./contexts/PdfNavContext";


/** Map used by connect logic for scenarios defined via the SDK. */
const sdkScenarioMap: Record<string, RealtimeAgent[]> = {
  PSW: pswTutorScenario,
  ECA: pswTutorScenario,
};

/** Public URL to Mary.pdf (ensure it’s world-readable or signed). */
const MARY_PDF_URL =
  "https://storage.googleapis.com/aiempower-bucket-mary-output/Mary.pdf";

/** Default PDF zoom and logical→PDF page offset (buffer).
 *  Example provided: printed 1099 → pdf 1067 ⇒ offset = -32
 */
const DEFAULT_PDF_ZOOM = 80;
const DEFAULT_PAGE_OFFSET = -32;

type RightPaneMode = "pdf" | "logs";

function App() {
  const searchParams = useSearchParams()!;
  const urlCodec = searchParams.get("codec") || "opus";

  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const handoffTriggeredRef = useRef(false);

  // Hidden <audio> for SDK playback
  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const el = document.createElement("audio");
    el.autoplay = true;
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const { connect, disconnect, sendUserText, sendEvent, interrupt, mute } =
    useRealtimeSession({
      onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
      onAgentHandoff: (agentName: string) => {
        handoffTriggeredRef.current = true;
        setSelectedAgentName(agentName);
      },
    });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  // UI state
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // default to true on server-side render
    const stored = localStorage.getItem("pushToTalkUI");
    return stored ? stored === "true" : true; // fallback to true if no stored value
  });
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return true;
      const stored = localStorage.getItem("audioPlaybackEnabled");
      return stored ? stored === "true" : true;
    }
  );

  // === PDF viewer state (NEW) ===
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("pdf"); // default to PDF
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [pdfZoom, setPdfZoom] = useState<number>(DEFAULT_PDF_ZOOM);
  const [pageOffset, setPageOffset] = useState<number>(DEFAULT_PAGE_OFFSET);


  const goToPage = (page: number) => {
    setPdfPage(Math.max(1, Math.floor(page)));
  };
  const setZoom = (zoom: number) => {
    setPdfZoom(Math.max(10, Math.floor(zoom)));
  };
  /** Jump using printed/manual page numbers (applies offset buffer). */
  const goToLogicalPage = (printedPage: number) => {
    const mapped = Math.max(1, Math.floor(printedPage) + pageOffset);
    setPdfPage(mapped);
    // ensure the pane is visible when we jump via citation
    setRightPaneMode("pdf");
  };
  const getOffset = () => pageOffset;
  const setOffset = (o: number) => setPageOffset(Math.floor(o));

  // function handlePdfTotalPages(n: number) {
  //   // clamp current page to [1, n]
  //   setPdfPage((p) => Math.min(Math.max(1, p), Math.max(1, n)));
  // }

  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error("Failed to send via SDK", err);
    }
  };

  useHandleSessionHistory();

  // Pick agent set from URL (or default)
  useEffect(() => {
    // Read current param (if any)
    const current = searchParams.get("agentConfig") || "";

    // Compute a safe fallback that definitely exists
    const keys = Object.keys(allAgentSets);
    const fallback = keys.includes(defaultAgentSetKey) ? defaultAgentSetKey : keys[0];

    // Decide the desired key (current if valid, else fallback)
    const desired = keys.includes(current) ? current : fallback;

    // Only update the URL if it actually needs to change
    if (current !== desired) {
      const url = new URL(window.location.href);
      url.searchParams.set("agentConfig", desired);
      // IMPORTANT: Use history.replaceState to avoid page reloads
      window.history.replaceState(null, "", url.toString());
    }

    // Initialize the agent set based on the resolved key
    const agents = allAgentSets[desired] || [];
    const agentKeyToUse = agents[0]?.name || "";
    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
    // We only depend on the string form of searchParams to avoid unnecessary loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Auto-connect when agent name resolved
  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  // Breadcrumb + session update after connect/handoff
  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  // Reflect PTT toggles to session
  useEffect(() => {
    if (sessionStatus === "CONNECTED") updateSession();
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");
    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }
    return data.client_secret.value;
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || "default";
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");
      try {
        const EPHEMERAL_KEY = await fetchEphemeralKey();
        if (!EPHEMERAL_KEY) return;
        const agentsToConnect = sdkScenarioMap[agentSetKey];
        if (!agentsToConnect || agentsToConnect.length === 0) {
          console.error("Agent configuration is missing or empty!");
          setSessionStatus("DISCONNECTED");
          return;
        }
        const companyName =
          agentSetKey === "customerServiceRetail"
            ? customerServiceRetailCompanyName
            : chatSupervisorCompanyName;
        const guardrail = createModerationGuardrail(companyName);
        await connect({
          getEphemeralKey: async () => EPHEMERAL_KEY,
          initialAgents: agentsToConnect,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: { addTranscriptBreadcrumb },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    } else {
      console.error(
        `Agent config key "${agentSetKey}" not found in sdkScenarioMap!`
      );
    }
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);
    sendClientEvent({
      type: "conversation.item.create",
      item: {
        id,
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendClientEvent({ type: "response.create" }, "(simulated user text message)");
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    const turnDetection = isPTTActive
      ? null
      : {
        type: "server_vad",
        threshold: 0.9,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
        create_response: true,
      };

    sendEvent({
      type: "session.update",
      session: { turn_detection: turnDetection },
    });

    if (shouldTriggerResponse) sendSimulatedUserMessage("hi");
    return;
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();
    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error("Failed to send via SDK", err);
    }
    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== "CONNECTED") return;
    interrupt();
    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: "input_audio_buffer.clear" }, "clear PTT buffer");
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== "CONNECTED" || !isPTTUserSpeaking) return;
    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: "input_audio_buffer.commit" }, "commit PTT");
    sendClientEvent({ type: "response.create" }, "trigger response PTT");
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };
  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentConfig = e.target.value;
    const url = new URL(window.location.href);
    url.searchParams.set("agentConfig", newAgentConfig);
    window.history.replaceState(null, "", url.toString());
    // Optionally trigger state updates immediately (the useEffect above will re-run anyway)
  };

  const handleSelectedAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentName = e.target.value;
    // No need to reload the page; just update state and reconnect
    disconnectFromRealtime();
    setSelectedAgentName(newAgentName);
  };

  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  // Persist UI state
  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) setIsPTTActive(storedPushToTalkUI === "true");
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded)
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled)
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
  }, []);
  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);
  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);
  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  // Sync mute/playback state
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current
          .play()
          .catch((err) => console.warn("Autoplay may be blocked:", err));
      } else {
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn("Failed to toggle SDK mute", err);
    }
  }, [isAudioPlaybackEnabled]);
  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn("mute sync after connect failed", err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  // Recording
  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  const agentSetKey = searchParams.get("agentConfig") || "default";

  return (
    <PdfNavProvider
      goToPage={goToPage}
      goToLogicalPage={goToLogicalPage}
      setZoom={setZoom}
      getOffset={getOffset}
      setOffset={setOffset}
    >
      <div className="text-base flex flex-col h-screen min-h-0 bg-background text-foreground overflow-hidden relative">
        {/* ===== Top Bar ===== */}
        <div className="flex-none p-5 text-lg font-semibold flex justify-between items-center rounded-2xl bg-white text-foreground border border-gray-200">
          {/* Left: Logo + Title */}
          <div
            className="flex items-center cursor-pointer"
            onClick={() => window.location.reload()}
          >
            <Image
              src="/aiempower-logomark.png"
              alt="AI Empower Inc. Logo"
              width={40}
              height={40}
              className="mr-2"
            />
            <div className="flex flex-col">
              <span className="leading-5">AI Empower Learning Platform</span>
              <span className="text-sm font-normal text-gray-500">PSW Course</span>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-3">
            {/* Toggle right pane: PDF / Logs */}
            <button
              onClick={() =>
                setRightPaneMode((m) => (m === "pdf" ? "logs" : "pdf"))
              }
              className="px-3 py-2 border rounded-md text-sm bg-gray-50 hover:bg-gray-100"
              title="Toggle between PDF viewer and Logs"
            >
              {rightPaneMode === "pdf" ? "Logs" : "Open Manual"}
            </button>

            <label className="text-base font-medium">Course</label>
            <div className="relative inline-block">
              <select
                value={agentSetKey}
                onChange={handleAgentChange}
                className="appearance-none bg-background text-foreground border border-gray-300 rounded-lg text-base px-3 py-2 pr-8 focus:outline-none focus:ring-1"
              >
                {Object.keys(allAgentSets).map((agentKey) => (
                  <option
                    key={agentKey}
                    value={agentKey}
                    className="bg-background text-foreground"
                  >
                    {agentKey}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>

            {agentSetKey && (
              <div className="flex items-center gap-2">
                <label className="text-base font-medium">Teacher</label>
                <div className="relative inline-block">
                  <select
                    value={selectedAgentName}
                    onChange={handleSelectedAgentChange}
                    className="appearance-none bg-background text-foreground border border-gray-300 rounded-lg text-base px-3 py-2 pr-8 focus:outline-none focus:ring-1"
                  >
                    {selectedAgentConfigSet?.map((agent) => (
                      <option
                        key={agent.name}
                        value={agent.name}
                        className="bg-background text-foreground"
                      >
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.44l3.71-3.21a.75.75 0 111.04 1.08l-4.25 3.65a.75.75 0 01-1.04 0L5.21 8.27a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== Main Panes ===== */}
        <div className="flex flex-1 min-h-0 gap-4 px-6 overflow-hidden relative">
          {/* Left: Transcript */}
          <div className="flex flex-col min-h-0 basis-full md:basis-2/5 xl:basis-5/12">
            <Transcript
              userText={userText}
              setUserText={setUserText}
              onSendMessage={handleSendTextMessage}
              downloadRecording={downloadRecording}
              canSend={sessionStatus === "CONNECTED"}
            />
          </div>

          {/* Right: PDF viewer (default) or Logs */}
          <div className="flex flex-col min-h-0 basis-full md:basis-3/5 xl:basis-7/12">
            {rightPaneMode === "pdf" ? (
              <PdfPane
                url={MARY_PDF_URL}
                renderedPage={pdfPage}
                zoomPct={pdfZoom}
                label="PSW Manual"
              />
            ) : (
              <Events isExpanded={isEventsPaneExpanded} />
            )}
          </div>
        </div>

        {/* ===== Bottom Toolbar ===== */}
        <BottomToolbar
          sessionStatus={sessionStatus}
          onToggleConnection={onToggleConnection}
          isPTTActive={isPTTActive}
          setIsPTTActive={setIsPTTActive}
          isPTTUserSpeaking={isPTTUserSpeaking}
          handleTalkButtonDown={handleTalkButtonDown}
          handleTalkButtonUp={handleTalkButtonUp}
          isEventsPaneExpanded={isEventsPaneExpanded}
          setIsEventsPaneExpanded={setIsEventsPaneExpanded}
          isAudioPlaybackEnabled={isAudioPlaybackEnabled}
          setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
          codec={urlCodec}
          onCodecChange={handleCodecChange}
        />
      </div>
    </PdfNavProvider>
  );
}

export default App;
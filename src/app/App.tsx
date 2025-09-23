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
const MIN_PDF_ZOOM = 50;
const MAX_PDF_ZOOM = 160;
const DEFAULT_SPLIT_RATIO = 0.45;

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
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return true; // default to true on server-side render
    const stored = localStorage.getItem("pushToTalkUI");
    return stored ? stored === "true" : true; // fallback to true if no stored value
  });
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);

  // ✅ FIX: define both states correctly (the previous line was broken)
  const [isEventsPaneExpanded, setIsEventsPaneExpanded] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("audioPlaybackEnabled");
    return stored ? stored === "true" : true;
  });

  // ✅ FIX: right pane mode state (used later)
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("pdf");

  // === PDF viewer state (NEW) ===
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [pdfZoom, setPdfZoom] = useState<number>(DEFAULT_PDF_ZOOM);
  const [pageOffset, setPageOffset] = useState<number>(DEFAULT_PAGE_OFFSET);

  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [splitRatio, setSplitRatio] = useState<number>(DEFAULT_SPLIT_RATIO);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState<boolean>(false);
  const wasLogsExpandedRef = useRef<boolean>(isEventsPaneExpanded);

  useEffect(() => {
    const wasExpanded = wasLogsExpandedRef.current;
    if (isEventsPaneExpanded && !wasExpanded) {
      setRightPaneMode("logs");
    }
    if (!isEventsPaneExpanded && wasExpanded) {
      setRightPaneMode("pdf");
    }
    wasLogsExpandedRef.current = isEventsPaneExpanded;
  }, [isEventsPaneExpanded]);

  const goToPage = (page: number) => {
    setPdfPage(Math.max(1, Math.floor(page)));
  };
  const setZoom = (zoom: number) => {
    const clampedZoom = Math.min(
      MAX_PDF_ZOOM,
      Math.max(MIN_PDF_ZOOM, Math.floor(zoom))
    );
    setPdfZoom(clampedZoom);
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

  const handlePageStep = (delta: number) => {
    goToPage(pdfPage + delta);
  };

  const handlePageInput = (page: number) => {
    if (Number.isNaN(page)) return;
    goToPage(page);
  };

  const handleZoomStep = (delta: number) => {
    setZoom(pdfZoom + delta);
  };

  const handleZoomInput = (zoom: number) => {
    if (Number.isNaN(zoom)) return;
    setZoom(zoom);
  };

  const resetPdfView = () => {
    goToPage(1);
    setZoom(DEFAULT_PDF_ZOOM);
  };

  const handleRightPaneModeChange = (mode: RightPaneMode) => {
    if (mode === "logs") {
      if (!isEventsPaneExpanded) {
        setIsEventsPaneExpanded(true);
      }
      setRightPaneMode("logs");
      return;
    }
    setRightPaneMode("pdf");
  };

  const resetSplitRatio = () => setSplitRatio(DEFAULT_SPLIT_RATIO);

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

  const handleSplitPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (!isDesktopLayout) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsDraggingSplit(true);
  };
  const handleSplitKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (!isDesktopLayout) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSplitRatio((value) => Math.max(0.25, value - 0.02));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setSplitRatio((value) => Math.min(0.75, value + 0.02));
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsDesktopLayout(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isDraggingSplit || typeof window === "undefined") return;
    const handlePointerMove = (event: PointerEvent) => {
      if (!splitContainerRef.current || !isDesktopLayout) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const relativeX = (event.clientX - rect.left) / rect.width;
      const clamped = Math.min(0.75, Math.max(0.25, relativeX));
      setSplitRatio(clamped);
    };
    const handlePointerUp = () => setIsDraggingSplit(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("pointerleave", handlePointerUp);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("pointerleave", handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDraggingSplit, isDesktopLayout]);

  useEffect(() => {
    if (!isDesktopLayout) setIsDraggingSplit(false);
  }, [isDesktopLayout]);

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
  const splitRatioPercent = Math.round(splitRatio * 100);

  const leftPaneStyle: React.CSSProperties | undefined = isDesktopLayout
    ? { flexBasis: `${(splitRatio * 100).toFixed(1)}%` }
    : undefined;
  const rightPaneStyle: React.CSSProperties | undefined = isDesktopLayout
    ? { flexBasis: `${((1 - splitRatio) * 100).toFixed(1)}%` }
    : undefined;

  return (
    <PdfNavProvider
      goToPage={goToPage}
      goToLogicalPage={goToLogicalPage}
      setZoom={setZoom}
      getOffset={getOffset}
      setOffset={setOffset}
    >
      {/* ✅ Height/scroll fixes: allow mobile scroll, keep desktop tidy */}
      <div className="text-base flex flex-col min-h-[100dvh] lg:h-screen w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-5 pb-10 gap-6 text-foreground relative">
        {/* ===== Top Bar ===== */}
        <div className="flex-none rounded-lg-theme border border-border bg-card/95 backdrop-blur-sm shadow-soft px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Logo + Title */}
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => window.location.reload()}
          >
            <Image
              src="/aiempower-logomark.png"
              alt="AI Empower Inc. Logo"
              width={40}
              height={40}
              className="rounded-full ring-2 ring-accent/20"
            />
            <span className="flex flex-col">
              {/* ✅ Branding restored (no sample names) */}
              <span className="text-xl font-semibold tracking-tight text-foreground">
                AI Empower Inc.
              </span>
              <span className="text-sm text-muted-soft">
                PSW Tutor Studio
              </span>
            </span>
          </button>

          {/* Right: controls */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="text-sm font-medium text-muted-soft">Course</label>
            <div className="relative inline-block">
              <select
                value={agentSetKey}
                onChange={handleAgentChange}
                className="appearance-none bg-card/90 text-foreground border border-border rounded-full text-sm px-4 py-2 pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {Object.keys(allAgentSets).map((agentKey) => (
                  <option
                    key={agentKey}
                    value={agentKey}
                    className="bg-card text-foreground"
                  >
                    {agentKey}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-soft">
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
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-muted-soft">Teacher</label>
                <div className="relative inline-block">
                  <select
                    value={selectedAgentName}
                    onChange={handleSelectedAgentChange}
                    className="appearance-none bg-card/90 text-foreground border border-border rounded-full text-sm px-4 py-2 pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {selectedAgentConfigSet?.map((agent) => (
                      <option
                        key={agent.name}
                        value={agent.name}
                        className="bg-card text-foreground"
                      >
                        {agent.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-soft">
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
        <div className="flex-1 min-h-0 w-full">
          <div
            ref={splitContainerRef}
            className="flex flex-col gap-4 min-h-0 items-stretch lg:h-full lg:flex-row"
          >
            {/* LEFT: Transcript — ✅ fills to bottom immediately */}
<div
  className="flex flex-col min-h-[320px] flex-1 min-w-0 transition-[flex-basis] duration-200"
  style={leftPaneStyle}
>
  <div className="flex-1 min-h-0 overflow-hidden rounded-lg-theme border border-border bg-card/95">
    <Transcript
      userText={userText}
      setUserText={setUserText}
      onSendMessage={handleSendTextMessage}
      downloadRecording={downloadRecording}
      canSend={sessionStatus === "CONNECTED"}
    />
  </div>
</div>

            {/* Divider (desktop) */}
            <div
              className="hidden lg:flex items-stretch justify-center"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
            >
              <button
                type="button"
                role="slider"
                onPointerDown={handleSplitPointerDown}
                onKeyDown={handleSplitKeyDown}
                onDoubleClick={resetSplitRatio}
                className="group relative flex h-full w-6 items-center justify-center cursor-col-resize"
                aria-valuenow={splitRatioPercent}
                aria-valuemin={25}
                aria-valuemax={75}
                aria-valuetext={`${splitRatioPercent}% transcript width`}
                title="Drag to resize panels. Double-click to reset."
              >
                <span
                  className={`block h-[80%] w-[4px] rounded-full transition-colors ${
                    isDraggingSplit ? "bg-accent" : "bg-accent-soft"
                  }`}
                />
                <span className="pointer-events-none absolute top-1/2 hidden -translate-y-1/2 rounded-full border border-border bg-card/95 px-2 py-1 text-xs text-muted-soft shadow-soft group-hover:flex">
                  Drag
                </span>
              </button>
            </div>

            {/* RIGHT: PDF / Logs — responsive with manual controls */}
            <div
              className="flex flex-col min-h-[320px] flex-1 min-w-0 transition-[flex-basis] duration-200"
              style={rightPaneStyle}
            >
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg-theme border border-border bg-card/95 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/90 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-soft">
                      {rightPaneMode === "pdf" ? "PSW Manual" : "Session Logs"}
                    </span>
                    <div className="inline-flex items-center rounded-full border border-border bg-card/80 p-1">
                      <button
                        type="button"
                        onClick={() => handleRightPaneModeChange("pdf")}
                        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          rightPaneMode === "pdf"
                            ? "bg-foreground text-background shadow-sm"
                            : "text-muted-soft hover:text-foreground"
                        }`}
                        aria-pressed={rightPaneMode === "pdf"}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRightPaneModeChange("logs")}
                        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                          rightPaneMode === "logs"
                            ? "bg-foreground text-background shadow-sm"
                            : isEventsPaneExpanded
                            ? "text-muted-soft hover:text-foreground"
                            : "text-muted-soft/70 cursor-not-allowed"
                        }`}
                        aria-pressed={rightPaneMode === "logs"}
                        aria-disabled={!isEventsPaneExpanded}
                        disabled={!isEventsPaneExpanded && rightPaneMode !== "logs"}
                        title={
                          isEventsPaneExpanded
                            ? "View real-time session logs"
                            : "Enable logs from the toolbar to view events"
                        }
                      >
                        Logs
                      </button>
                    </div>
                  </div>
                  {rightPaneMode === "pdf" ? (
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-soft">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide">Page</span>
                        <div className="flex items-center gap-1 rounded-full border border-border bg-card/80 px-2 py-1">
                          <button
                            type="button"
                            onClick={() => handlePageStep(-1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-card/70 text-foreground hover:bg-card"
                            disabled={pdfPage <= 1}
                            aria-label="Previous page"
                          >
                            &minus;
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={pdfPage}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (Number.isNaN(value)) return;
                              handlePageInput(value);
                            }}
                            className="w-14 rounded-full border border-transparent bg-card px-2 py-1 text-center text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                            aria-label="Current PDF page"
                          />
                          <button
                            type="button"
                            onClick={() => handlePageStep(1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-card/70 text-foreground hover:bg-card"
                            aria-label="Next page"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-wide">Zoom</span>
                        <div className="flex items-center gap-2 rounded-full bg-card/80 px-3 py-1">
                          <button
                            type="button"
                            onClick={() => handleZoomStep(-10)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-card/70 text-foreground hover:bg-card"
                            aria-label="Zoom out"
                          >
                            &minus;
                          </button>
                          <input
                            type="range"
                            min={MIN_PDF_ZOOM}
                            max={MAX_PDF_ZOOM}
                            step={10}
                            value={pdfZoom}
                            onChange={(event) => handleZoomInput(Number(event.target.value))}
                            className="h-2 w-28 accent-[var(--accent)]"
                            aria-label="Zoom level"
                          />
                          <button
                            type="button"
                            onClick={() => handleZoomStep(10)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-card/70 text-foreground hover:bg-card"
                            aria-label="Zoom in"
                          >
                            +
                          </button>
                          <span className="text-xs font-medium text-muted">{pdfZoom}%</span>
                          <button
                            type="button"
                            onClick={resetPdfView}
                            className="inline-flex items-center rounded-full bg-accent-soft/70 px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-500">
                      <span
                        className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"
                        aria-hidden="true"
                      />
                      Live feed
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-[320px]">
                  {rightPaneMode === "pdf" ? (
                    <div className="relative h-[60vh] sm:h-[68vh] lg:h-full w-full overflow-hidden rounded-b-lg-theme bg-card">
                      <PdfPane
                        url={MARY_PDF_URL}
                        renderedPage={pdfPage}
                        zoomPct={pdfZoom}
                        label="PSW Manual"
                        className="rounded-none"
                      />
                      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5" />
                    </div>
                  ) : (
                    <div className="h-[55vh] sm:h-[62vh] lg:h-full">
                      <Events isExpanded={isEventsPaneExpanded} />
                    </div>
                  )}
                </div>
              </div>
            </div>

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

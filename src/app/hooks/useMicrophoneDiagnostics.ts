import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionStatus } from "../types";

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  message: string;
  description?: string;
  action?: DiagnosticAction;
}

export interface DiagnosticAction {
  label: string;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
}

interface UseMicrophoneDiagnosticsOptions {
  sessionStatus: SessionStatus;
  getLocalMicrophoneTrack: () => MediaStreamTrack | null;
  isPushToTalkActive: boolean;
  isUserCurrentlyTalking: boolean;
}

const SILENCE_THRESHOLD = 2.5;
const SILENCE_DURATION_MS = 4000;

type PermissionStateValue = "granted" | "denied" | "prompt" | "unsupported" | "error";

export function useMicrophoneDiagnostics({
  sessionStatus,
  getLocalMicrophoneTrack,
  isPushToTalkActive,
  isUserCurrentlyTalking,
}: UseMicrophoneDiagnosticsOptions) {
  const [permissionState, setPermissionState] = useState<PermissionStateValue>(
    "unsupported"
  );
  const [trackMuted, setTrackMuted] = useState(false);
  const [trackEnded, setTrackEnded] = useState(false);
  const [trackMissing, setTrackMissing] = useState(false);
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [hasMicrophoneSupport, setHasMicrophoneSupport] = useState(true);
  const [audioContextUnavailable, setAudioContextUnavailable] = useState(false);
  const [permissionRequestInFlight, setPermissionRequestInFlight] = useState(false);

  const activeTrackRef = useRef<MediaStreamTrack | null>(null);
  const trackVersionRef = useRef(0);
  const [trackVersion, setTrackVersion] = useState(0);
  const silenceWarningRef = useRef(false);

  const updateSilenceWarning = (next: boolean) => {
    if (silenceWarningRef.current === next) return;
    silenceWarningRef.current = next;
    setSilenceWarning(next);
  };

  const requestPermissionRetry = useCallback(async () => {
    if (permissionRequestInFlight) {
      return;
    }
    if (typeof navigator === "undefined") {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn(
        "Microphone diagnostics: browser does not support getUserMedia for permission retry"
      );
      return;
    }

    try {
      setPermissionRequestInFlight(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.warn(
        "Microphone diagnostics: retrying microphone permission failed",
        error
      );
    } finally {
      setPermissionRequestInFlight(false);
    }
  }, [permissionRequestInFlight]);

  // Permission diagnostics
  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    if (!navigator.mediaDevices) {
      setHasMicrophoneSupport(false);
      return;
    }

    let isCancelled = false;
    const permissionsApi = (navigator as any).permissions;
    if (!permissionsApi?.query) {
      setPermissionState("unsupported");
      return;
    }

    let permissionStatus: PermissionStatus | null = null;

    const updateState = (state: PermissionStateValue) => {
      if (!isCancelled) setPermissionState(state);
    };

    (async () => {
      try {
        const status = await permissionsApi.query({ name: "microphone" });
        permissionStatus = status;
        updateState(status.state as PermissionStateValue);
        const handlePermissionChange = () => {
          updateState(status.state as PermissionStateValue);
        };
        status.onchange = handlePermissionChange;
      } catch (error) {
        console.warn("Microphone diagnostics: unable to query permission state", error);
        updateState("error");
      }
    })();

    return () => {
      isCancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  // Track lifecycle diagnostics
  useEffect(() => {
    if (sessionStatus !== "CONNECTED") {
      activeTrackRef.current = null;
      setTrackMuted(false);
      setTrackEnded(false);
      setTrackMissing(false);
      updateSilenceWarning(false);
      return;
    }

    const track = getLocalMicrophoneTrack();
    if (!track) {
      activeTrackRef.current = null;
      setTrackMuted(false);
      setTrackEnded(false);
      setTrackMissing(true);
      updateSilenceWarning(false);
      return;
    }

    setTrackMissing(false);
    if (activeTrackRef.current === track) {
      return;
    }

    activeTrackRef.current = track;
    setTrackMuted(track.muted);
    setTrackEnded(track.readyState === "ended");
    trackVersionRef.current += 1;
    setTrackVersion(trackVersionRef.current);

    const handleMute = () => setTrackMuted(true);
    const handleUnmute = () => setTrackMuted(false);
    const handleEnded = () => setTrackEnded(true);

    track.addEventListener("mute", handleMute);
    track.addEventListener("unmute", handleUnmute);
    track.addEventListener("ended", handleEnded);

    return () => {
      track.removeEventListener("mute", handleMute);
      track.removeEventListener("unmute", handleUnmute);
      track.removeEventListener("ended", handleEnded);
    };
  }, [sessionStatus, getLocalMicrophoneTrack]);

  // Silence detection diagnostics
  useEffect(() => {
    if (sessionStatus !== "CONNECTED") {
      updateSilenceWarning(false);
      setAudioContextUnavailable(false);
      return;
    }

    const track = activeTrackRef.current;
    if (!track || track.readyState !== "live") {
      updateSilenceWarning(false);
      setAudioContextUnavailable(false);
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let rafId: number;
    let disposed = false;
    let silenceStart: number | null = null;

    setAudioContextUnavailable(false);
    const startMonitoring = async () => {
      try {
        audioContext = new AudioContext();
        if (audioContext.state === "suspended") {
          await audioContext.resume().catch(() => undefined);
        }
        if (disposed) {
          return;
        }
        const monitoredStream = new MediaStream([track]);
        source = audioContext.createMediaStreamSource(monitoredStream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        const loop = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i += 1) {
            sum += Math.abs(dataArray[i] - 128);
          }
          const averageDeviation = sum / bufferLength;

          const listeningActive = !isPushToTalkActive || isUserCurrentlyTalking;

          if (averageDeviation > SILENCE_THRESHOLD) {
            silenceStart = null;
            updateSilenceWarning(false);
          } else if (listeningActive) {
            if (silenceStart == null) {
              silenceStart = performance.now();
            } else if (performance.now() - silenceStart > SILENCE_DURATION_MS) {
              updateSilenceWarning(true);
            }
          } else {
            silenceStart = null;
            updateSilenceWarning(false);
          }

          rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
      } catch (error) {
        console.warn("Microphone diagnostics: AudioContext unavailable", error);
        setAudioContextUnavailable(true);
      }
    };

    startMonitoring();

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (source && analyser) {
        try {
          source.disconnect();
          analyser.disconnect();
        } catch (error) {
          console.warn("Microphone diagnostics: error cleaning up analyser", error);
        }
      }
      if (audioContext) {
        audioContext.close().catch(() => undefined);
      }
    };
  }, [sessionStatus, trackVersion, isPushToTalkActive, isUserCurrentlyTalking]);

  const diagnostics = useMemo<Diagnostic[]>(() => {
    const messages: Diagnostic[] = [];

    if (!hasMicrophoneSupport) {
      messages.push({
        id: "mic-support-missing",
        severity: "error",
        message: "This browser does not expose microphone access.",
        description:
          "Please switch to a browser that supports WebRTC microphone capture (latest Chrome, Edge, or Safari).",
      });
      return messages;
    }

    if (permissionState === "denied") {
      messages.push({
        id: "mic-permission-denied",
        severity: "error",
        message: "Microphone access is blocked.",
        description:
          "Grant microphone permission in your browser settings and reload the page so the agent can hear you. If you blocked the prompt, try requesting access again.",
        action: {
          label: permissionRequestInFlight
            ? "Requesting access..."
            : "Retry microphone access",
          onSelect: requestPermissionRetry,
          disabled: permissionRequestInFlight,
        },
      });
    } else if (permissionState === "prompt") {
      messages.push({
        id: "mic-permission-prompt",
        severity: "warning",
        message: "Awaiting microphone permission.",
        description:
          "The browser is still waiting for access. Accept the permission prompt so we can capture your audio.",
      });
    } else if (permissionState === "error") {
      messages.push({
        id: "mic-permission-error",
        severity: "warning",
        message: "Unable to read microphone permission state.",
        description:
          "We could not verify the permission status. If audio capture fails, try refreshing or checking browser privacy settings.",
      });
    }

    if (trackMissing && sessionStatus === "CONNECTED") {
      messages.push({
        id: "mic-track-missing",
        severity: "error",
        message: "No microphone input is active.",
        description:
          "We could not attach to your microphone. Check if the device is selected in your browser or if another app is using it.",
      });
    }

    if (trackEnded) {
      messages.push({
        id: "mic-track-ended",
        severity: "error",
        message: "Microphone disconnected.",
        description:
          "We lost access to the microphone input. Check if the device was unplugged or selected from your OS audio settings, then reconnect.",
      });
    } else if (trackMuted) {
      messages.push({
        id: "mic-track-muted",
        severity: "warning",
        message: "Microphone input looks muted.",
        description:
          "We are receiving a muted audio track. Ensure your hardware mute switch or OS-level mute is disabled.",
      });
    }

    if (silenceWarning && sessionStatus === "CONNECTED") {
      messages.push({
        id: "mic-no-level",
        severity: "warning",
        message: "We cannot hear any audio from your microphone.",
        description:
          "While listening is active, we detected several seconds of complete silence. Check if the microphone is muted or configured to the wrong device.",
      });
    }

    if (audioContextUnavailable) {
      messages.push({
        id: "mic-monitoring-unavailable",
        severity: "warning",
        message: "Audio level monitoring is disabled.",
        description:
          "Your browser blocked microphone analysis, so we cannot detect silence automatically. Reload the page or allow audio processing to re-enable monitoring.",
      });
    }

    return messages;
  }, [
    hasMicrophoneSupport,
    permissionState,
    trackEnded,
    trackMuted,
    trackMissing,
    silenceWarning,
    sessionStatus,
    audioContextUnavailable,
    requestPermissionRetry,
    permissionRequestInFlight,
  ]);

  return { diagnostics };
}

export default useMicrophoneDiagnostics;

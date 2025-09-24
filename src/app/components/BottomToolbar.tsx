// src/app/components/BottomToolbar.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MicrophoneDiagnostics, SessionStatus } from "@/app/types";
import {
  Plug,
  PlugZap,
  Radio,
  Mic,
  MicOff,
  Volume2,
  AlertTriangle,
  ListTree, // note: capital T
} from "lucide-react";

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;

  isPTTActive: boolean;
  setIsPTTActive: (val: boolean) => void;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;

  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (val: boolean) => void;

  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (val: boolean) => void;

  /** Preserved for compatibility; not rendered in UI */
  codec?: string;
  onCodecChange?: (newCodec: string) => void;

  microphoneDiagnostics?: MicrophoneDiagnostics;
}

function BottomToolbar({
  sessionStatus,
  onToggleConnection,

  isPTTActive,
  setIsPTTActive,
  isPTTUserSpeaking,
  handleTalkButtonDown,
  handleTalkButtonUp,

  isEventsPaneExpanded,
  setIsEventsPaneExpanded,

  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  microphoneDiagnostics,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  // Hydration safety for dynamic labels/states
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const connectionLabel = useMemo(() => {
    if (isConnected) return "Disconnect";
    if (isConnecting) return "Connecting...";
    return "Connect";
  }, [isConnected, isConnecting]);

  const connectionIcon = useMemo(() => {
    if (isConnected) return <Plug className="h-4 w-4" />;
    if (isConnecting) return <Radio className="h-4 w-4 animate-pulse" />;
    return <PlugZap className="h-4 w-4" />;
  }, [isConnected, isConnecting]);

  const connectionBtnClasses = useMemo(() => {
    const base =
      "text-base px-5 py-2 min-w-[9rem] rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
    const cursor = isConnecting ? "cursor-not-allowed" : "cursor-pointer";
    if (isConnected) {
      return `bg-red-500/90 hover:bg-red-500 text-white shadow-sm ${cursor} ${base}`;
    }
    return `bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500/90 hover:to-emerald-600/90 text-white shadow-md ${cursor} ${base}`;
  }, [isConnected, isConnecting]);

  // Safe talk wrappers: no-op unless connected & PTT enabled
  const canTalk = mounted && isConnected && isPTTActive;

  const micLevelPercent = Math.min(
    100,
    Math.max(0, Math.round((microphoneDiagnostics?.level ?? 0) * 100)),
  );
  const micLabel = microphoneDiagnostics?.activeMicrophoneLabel
    ? microphoneDiagnostics.activeMicrophoneLabel
    : isConnected
    ? "Microphone ready"
    : "Microphone idle";

  const onSafeTalkDown = () => {
    if (!canTalk) return;
    handleTalkButtonDown();
  };

  const onSafeTalkUp = () => {
    if (!canTalk) return;
    handleTalkButtonUp();
  };

  return (
    <div className="w-full border border-border bg-card/95 backdrop-blur-sm rounded-lg-theme shadow-soft">
      <div className="px-5 py-4 flex flex-wrap items-center justify-center gap-4 lg:justify-between text-sm text-foreground">
        {/* Connection */}
        <button
          onClick={onToggleConnection}
          className={connectionBtnClasses}
          disabled={isConnecting}
          aria-label={connectionLabel}
        >
          <span className="inline-flex items-center gap-2">
            {connectionIcon}
            {connectionLabel}
          </span>
        </button>

        {/* Push-to-Talk */}
        <div className="flex flex-col gap-2 min-w-[260px]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-muted-soft inline-flex items-center gap-2">
              <Mic className="h-4 w-4 opacity-80" />
              Push to talk
            </span>

            {/* PTT Toggle chip */}
            <button
              type="button"
              onClick={() => setIsPTTActive(!isPTTActive)}
              disabled={!isConnected}
              aria-pressed={mounted ? isPTTActive : undefined}
              className={[
                "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 bg-card/80 transition-all",
                !isConnected ? "opacity-50 cursor-not-allowed" : "hover:bg-card",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              ].join(" ")}
            >
              <span
                className={[
                  "h-2.5 w-2.5 rounded-full",
                  mounted
                    ? isPTTActive
                      ? "bg-[var(--accent)]"
                      : "bg-muted"
                    : "bg-muted",
                ].join(" ")}
                aria-hidden
                suppressHydrationWarning
              />
              <span className="text-sm" suppressHydrationWarning>
                {mounted ? (isPTTActive ? "Enabled" : "Disabled") : "—"}
              </span>
            </button>

            {/* Talk button — modern, clear, hold-to-talk */}
            <button
              onMouseDown={onSafeTalkDown}
              onMouseUp={onSafeTalkUp}
              onTouchStart={onSafeTalkDown}
              onTouchEnd={onSafeTalkUp}
              disabled={!canTalk}
              aria-pressed={mounted ? isPTTUserSpeaking : undefined}
              title={
                isConnected
                  ? isPTTActive
                    ? "Hold to talk"
                    : "Enable Push to talk to use"
                  : "Connect first"
              }
              className={[
                "relative inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full transition-all border border-transparent",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                canTalk
                  ? isPTTUserSpeaking
                    ? "bg-emerald-600 text-white shadow-sm scale-[0.99]"
                    : "bg-accent-soft text-accent hover:bg-accent-soft/80 hover:shadow-sm"
                  : "bg-accent-soft/60 text-accent/70 cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              {isPTTUserSpeaking ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              <span className="font-medium" suppressHydrationWarning>
                {mounted
                  ? canTalk
                    ? isPTTUserSpeaking
                      ? "Listening… (Hold)"
                      : "Hold to Talk"
                    : "Talk"
                  : "Talk"}
              </span>

              {mounted && isPTTUserSpeaking && (
                <span className="absolute inset-0 rounded-full ring-2 ring-emerald-600/30 animate-ping pointer-events-none" />
              )}
            </button>
          </div>

          <div className="min-h-[18px]">
            {microphoneDiagnostics ? (
              microphoneDiagnostics.alert ? (
                <div
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-500"
                  role="status"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{microphoneDiagnostics.alert}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-soft">
                  <span className="truncate max-w-[160px]">
                    {micLabel}
                  </span>
                  <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted/30">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${micLevelPercent}%` }}
                    />
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Audio Playback */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-muted-soft inline-flex items-center gap-2">
            <Volume2 className="h-4 w-4 opacity-80" />
            Audio playback
          </span>

          <button
            type="button"
            onClick={() => setIsAudioPlaybackEnabled(!isAudioPlaybackEnabled)}
            disabled={!isConnected}
            aria-pressed={mounted ? isAudioPlaybackEnabled : undefined}
            className={[
              "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 bg-card/80 transition-all",
              !isConnected ? "opacity-50 cursor-not-allowed" : "hover:bg-card",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            ].join(" ")}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                mounted
                  ? isAudioPlaybackEnabled
                    ? "bg-[var(--accent)]"
                    : "bg-muted"
                  : "bg-muted",
              ].join(" ")}
              aria-hidden
              suppressHydrationWarning
            />
            <span className="text-sm" suppressHydrationWarning>
              {mounted ? (isAudioPlaybackEnabled ? "Enabled" : "Disabled") : "—"}
            </span>
          </button>
        </div>

        {/* Logs Panel */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-muted-soft inline-flex items-center gap-2">
            <ListTree className="h-4 w-4 opacity-80" />
            Logs panel
          </span>

          <button
            type="button"
            onClick={() => setIsEventsPaneExpanded(!isEventsPaneExpanded)}
            aria-pressed={mounted ? isEventsPaneExpanded : undefined}
            className={[
              "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 bg-card/80 transition-all",
              "hover:bg-card",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            ].join(" ")}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                mounted
                  ? isEventsPaneExpanded
                    ? "bg-[var(--accent)]"
                    : "bg-muted"
                  : "bg-muted",
              ].join(" ")}
              aria-hidden
              suppressHydrationWarning
            />
            <span className="text-sm" suppressHydrationWarning>
              {mounted ? (isEventsPaneExpanded ? "Shown" : "Hidden") : "—"}
            </span>
          </button>
        </div>

        {/* Codec props preserved but hidden (not visible in UI) */}
        <input type="hidden" value="preserved" aria-hidden />
      </div>
    </div>
  );
}

export default BottomToolbar;

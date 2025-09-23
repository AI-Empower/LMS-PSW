// src/app/components/BottomToolbar.tsx
"use client";

import React from "react";
import { SessionStatus } from "@/app/types";

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
  codec: string;
  onCodecChange: (newCodec: string) => void;
}

const statusLabels: Record<SessionStatus, string> = {
  CONNECTED: "Connected",
  CONNECTING: "Connecting…",
  DISCONNECTED: "Disconnected",
};

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
  codec,
  onCodecChange,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  const handleCodecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onCodecChange(e.target.value);
  };

  const getConnectionButtonLabel = () => {
    if (isConnected) return "Disconnect";
    if (isConnecting) return "Connecting...";
    return "Connect";
  };

  const getConnectionButtonClasses = () => {
    const baseClasses =
      "min-w-[9rem] rounded-md px-4 py-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";
    const cursorClass = isConnecting ? "cursor-not-allowed" : "cursor-pointer";

    if (isConnected) {
      return `bg-rose-600 text-white hover:bg-rose-700 ${cursorClass} ${baseClasses}`;
    }

    if (isConnecting) {
      return `bg-muted text-muted-soft ${cursorClass} ${baseClasses}`;
    }

    return `bg-emerald-600 text-white hover:bg-emerald-700 ${cursorClass} ${baseClasses}`;
  };

  return (
    <div className="flex-none w-full border-t border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-foreground md:justify-between">
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:gap-3">
          <button
            onClick={onToggleConnection}
            className={getConnectionButtonClasses()}
            disabled={isConnecting}
            aria-label={getConnectionButtonLabel()}
          >
            {getConnectionButtonLabel()}
          </button>
          <span className="text-xs font-medium text-muted-soft">
            Status: {statusLabels[sessionStatus]}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label htmlFor="push-to-talk" className="font-medium text-muted-soft">
            Push to talk
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1">
            <input
              id="push-to-talk"
              type="checkbox"
              checked={isPTTActive}
              onChange={(e) => setIsPTTActive(e.target.checked)}
              disabled={!isConnected}
              className="h-4 w-4 accent-[var(--accent)] disabled:opacity-50"
            />
            <span className="text-sm">Enable</span>
          </label>
          <button
            onMouseDown={handleTalkButtonDown}
            onMouseUp={handleTalkButtonUp}
            onTouchStart={handleTalkButtonDown}
            onTouchEnd={handleTalkButtonUp}
            disabled={!isPTTActive}
            className={[
              "rounded-md border border-border px-4 py-1 text-sm transition-colors",
              isPTTUserSpeaking ? "bg-foreground text-background" : "bg-card hover:bg-accent-soft",
              !isPTTActive ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            ].join(" ")}
            aria-pressed={isPTTUserSpeaking}
          >
            Talk
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label htmlFor="audio-playback" className="font-medium text-muted-soft">
            Audio playback
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1">
            <input
              id="audio-playback"
              type="checkbox"
              checked={isAudioPlaybackEnabled}
              onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
              disabled={!isConnected}
              className="h-4 w-4 accent-[var(--accent)] disabled:opacity-50"
            />
            <span className="text-sm">Enable</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label htmlFor="logs" className="font-medium text-muted-soft">
            Logs panel
          </label>
          <label className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1">
            <input
              id="logs"
              type="checkbox"
              checked={isEventsPaneExpanded}
              onChange={(e) => setIsEventsPaneExpanded(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <label htmlFor="codec-select" className="font-medium text-muted-soft">
            Codec
          </label>
          <select
            id="codec-select"
            value={codec}
            onChange={handleCodecChange}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Select codec"
          >
            <option className="bg-card text-foreground" value="opus">
              Opus (48 kHz)
            </option>
            <option className="bg-card text-foreground" value="pcmu">
              PCMU (8 kHz)
            </option>
            <option className="bg-card text-foreground" value="pcma">
              PCMA (8 kHz)
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default BottomToolbar;


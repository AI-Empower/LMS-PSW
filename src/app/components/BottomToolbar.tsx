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

  function getConnectionButtonLabel() {
    if (isConnected) return "Disconnect";
    if (isConnecting) return "Connecting...";
    return "Connect";
  }

  function getConnectionButtonClasses() {
    const base = "text-base px-5 py-2 min-w-[9rem] rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
    const cursor = isConnecting ? "cursor-not-allowed" : "cursor-pointer";
    if (isConnected) {
      return `bg-red-500/90 hover:bg-red-500 text-white shadow-sm ${cursor} ${base}`;
    }
    return `bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500/90 hover:to-emerald-600/90 text-white shadow-md ${cursor} ${base}`;
  }

  return (
    <div className="w-full border border-border bg-card/95 backdrop-blur-sm rounded-lg-theme shadow-soft">
      <div className="px-5 py-4 flex flex-wrap items-center justify-center gap-4 lg:justify-between text-sm text-foreground">
        <button
          onClick={onToggleConnection}
          className={getConnectionButtonClasses()}
          disabled={isConnecting}
          aria-label={getConnectionButtonLabel()}
        >
          {getConnectionButtonLabel()}
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="push-to-talk" className="font-medium text-muted-soft">
            Push to talk
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 bg-card/80">
            <input
              id="push-to-talk"
              type="checkbox"
              checked={isPTTActive}
              onChange={(e) => setIsPTTActive(e.target.checked)}
              disabled={!isConnected}
              className="w-4 h-4 accent-[var(--accent)] disabled:opacity-50"
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
              "px-4 py-2 rounded-full border border-transparent transition-all",
              isPTTUserSpeaking
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-accent-soft text-accent hover:bg-accent-soft/80",
              !isPTTActive
                ? "opacity-40 cursor-not-allowed"
                : "cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
            ].join(" ")}
            aria-pressed={isPTTUserSpeaking}
          >
            Talk
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="audio-playback" className="font-medium text-muted-soft">
            Audio playback
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 bg-card/80">
            <input
              id="audio-playback"
              type="checkbox"
              checked={isAudioPlaybackEnabled}
              onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
              disabled={!isConnected}
              className="w-4 h-4 accent-[var(--accent)] disabled:opacity-50"
            />
            <span className="text-sm">Enable</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="logs" className="font-medium text-muted-soft">
            Logs panel
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 bg-card/80">
            <input
              id="logs"
              type="checkbox"
              checked={isEventsPaneExpanded}
              onChange={(e) => setIsEventsPaneExpanded(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)]"
            />
            <span className="text-sm">Show</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-muted-soft">Codec</span>
          <select
            id="codec-select"
            value={codec}
            onChange={handleCodecChange}
            className="border border-transparent rounded-full bg-accent-soft/80 text-foreground px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 cursor-pointer"
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

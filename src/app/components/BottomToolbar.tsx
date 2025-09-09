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
    const base =
      "text-base px-4 py-2 w-36 rounded-md h-full transition-colors focus:outline-none focus:ring-1 focus:ring-accent";
    const cursor = isConnecting ? "cursor-not-allowed" : "cursor-pointer";
    if (isConnected) {
      // Red "Disconnect"
      return `bg-red-600 hover:bg-red-700 text-white ${cursor} ${base}`;
    }
    // Neutral "Connect"/"Connecting" — high contrast using tokens
    return `bg-foreground hover:opacity-90 text-background ${cursor} ${base}`;
  }

  return (
    // This container is visually a toolbar; layout height control is handled by the parent (wrap with `flex-none` in App.tsx).
    <div className="w-full border-t border-border bg-card text-foreground">
      <div className="p-4 flex flex-row items-center justify-center gap-x-6">
        {/* Connect / Disconnect */}
        <button
          onClick={onToggleConnection}
          className={getConnectionButtonClasses()}
          disabled={isConnecting}
          aria-label={getConnectionButtonLabel()}
        >
          {getConnectionButtonLabel()}
        </button>

        {/* Push-to-talk */}
        <div className="flex flex-row items-center gap-2">
          <input
            id="push-to-talk"
            type="checkbox"
            checked={isPTTActive}
            onChange={(e) => setIsPTTActive(e.target.checked)}
            disabled={!isConnected}
            className="w-4 h-4 accent-current disabled:opacity-50"
          />
          <label htmlFor="push-to-talk" className="flex items-center cursor-pointer">
            Push to talk
          </label>
          <button
            onMouseDown={handleTalkButtonDown}
            onMouseUp={handleTalkButtonUp}
            onTouchStart={handleTalkButtonDown}
            onTouchEnd={handleTalkButtonUp}
            disabled={!isPTTActive}
            className={[
              "px-4 py-1 rounded-md border border-border transition-colors",
              isPTTUserSpeaking ? "bg-background" : "bg-card",
              !isPTTActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-background",
              "focus:outline-none focus:ring-1 focus:ring-accent",
            ].join(" ")}
            aria-pressed={isPTTUserSpeaking}
          >
            Talk
          </button>
        </div>

        {/* Audio playback toggle */}
        <div className="flex flex-row items-center gap-2">
          <input
            id="audio-playback"
            type="checkbox"
            checked={isAudioPlaybackEnabled}
            onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
            disabled={!isConnected}
            className="w-4 h-4 accent-current disabled:opacity-50"
          />
          <label htmlFor="audio-playback" className="flex items-center cursor-pointer">
            Audio playback
          </label>
        </div>

        {/* Logs toggle */}
        <div className="flex flex-row items-center gap-2">
          <input
            id="logs"
            type="checkbox"
            checked={isEventsPaneExpanded}
            onChange={(e) => setIsEventsPaneExpanded(e.target.checked)}
            className="w-4 h-4 accent-current"
          />
          <label htmlFor="logs" className="flex items-center cursor-pointer">
            Logs
          </label>
        </div>

        {/* Codec select */}
        <div className="flex flex-row items-center gap-2">
          <div>Codec:</div>
          <select
            id="codec-select"
            value={codec}
            onChange={handleCodecChange}
            className="border border-border bg-background text-foreground rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
            aria-label="Select codec"
          >
            <option className="bg-background text-foreground" value="opus">
              Opus (48 kHz)
            </option>
            <option className="bg-background text-foreground" value="pcmu">
              PCMU (8 kHz)
            </option>
            <option className="bg-background text-foreground" value="pcma">
              PCMA (8 kHz)
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default BottomToolbar;
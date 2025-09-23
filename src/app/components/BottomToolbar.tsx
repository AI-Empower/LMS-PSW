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

interface SwitchControlProps {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}

const sessionStatusMeta: Record<SessionStatus, { label: string; dotClass: string }> = {
  CONNECTED: { label: "Connected", dotClass: "bg-emerald-500" },
  CONNECTING: { label: "Connecting…", dotClass: "bg-amber-400 animate-pulse" },
  DISCONNECTED: { label: "Disconnected", dotClass: "bg-slate-400" },
};

const codecOptions = [
  { value: "opus", label: "Studio", helper: "48 kHz" },
  { value: "pcmu", label: "Phone", helper: "8 kHz" },
  { value: "pcma", label: "Legacy", helper: "8 kHz" },
];

function SwitchControl({ label, checked, onToggle, disabled }: SwitchControlProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onToggle(!checked);
      }}
      className={`relative inline-flex h-9 w-16 flex-shrink-0 items-center rounded-full transition ${
        checked
          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
          : "bg-muted-soft/30"
      } ${
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:shadow-inner"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`}
    >
      <span
        className={`absolute left-1 top-1 h-7 w-7 rounded-full bg-card shadow transition-transform ${
          checked ? "translate-x-7" : ""
        }`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </button>
  );
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
  const statusInfo = sessionStatusMeta[sessionStatus];

  const connectionLabel = isConnected
    ? "Disconnect"
    : isConnecting
    ? "Connecting…"
    : "Connect";

  const connectionButtonClass = `text-base px-5 py-2 min-w-[9rem] rounded-full transition ${
    isConnecting
      ? "cursor-not-allowed bg-muted-soft/40 text-muted"
      : isConnected
      ? "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-sm hover:from-rose-500/90 hover:to-rose-600/90"
      : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md hover:from-emerald-500/90 hover:to-emerald-600/90"
  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`;

  const talkButtonClass = [
    "mt-2 w-full sm:mt-0 sm:w-auto sm:ml-2 inline-flex items-center justify-center gap-3 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    !isPTTActive
      ? "cursor-not-allowed bg-muted-soft/40 text-muted-soft"
      : isPTTUserSpeaking
      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-[0_12px_30px_rgba(16,185,129,0.35)]"
      : "bg-gradient-to-r from-foreground to-foreground/90 text-background hover:from-foreground/90 hover:to-foreground/80",
  ].join(" ");

  const handleCodecSelect = (value: string) => {
    if (value === codec) return;
    onCodecChange(value);
  };

  return (
    <div className="w-full border border-border bg-card/95 backdrop-blur-sm rounded-lg-theme shadow-soft">
      <div className="flex flex-col gap-5 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onToggleConnection}
            className={connectionButtonClass}
            disabled={isConnecting}
            aria-label={connectionLabel}
          >
            {connectionLabel}
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-soft">
            <span
              className={`h-2.5 w-2.5 rounded-full ${statusInfo.dotClass}`}
              aria-hidden="true"
            />
            <span className="font-medium text-foreground">{statusInfo.label}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="flex flex-col gap-3 min-w-[240px] md:max-w-[360px]">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1 text-left">
                <span className="text-sm font-medium text-muted-soft">Push to talk</span>
                <span className="text-xs text-muted-soft/80">
                  Hold the button to send your voice.
                </span>
              </div>
              <SwitchControl
                label="Toggle push to talk"
                checked={isPTTActive}
                onToggle={setIsPTTActive}
                disabled={!isConnected}
              />
              <span className="text-xs font-semibold text-muted-soft">
                {isPTTActive ? "On" : "Off"}
              </span>
            </div>
            <button
              onMouseDown={handleTalkButtonDown}
              onMouseUp={handleTalkButtonUp}
              onTouchStart={handleTalkButtonDown}
              onTouchEnd={handleTalkButtonUp}
              disabled={!isPTTActive}
              className={talkButtonClass}
              aria-pressed={isPTTUserSpeaking}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/30 ${
                  isPTTUserSpeaking ? "bg-white/20 animate-pulse" : "bg-white/10"
                }`}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 1a3 3 0 00-3 3v6a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10a7 7 0 01-14 0" />
                  <path d="M12 19v4" />
                  <path d="M8 23h8" />
                </svg>
              </span>
              <span>{isPTTUserSpeaking ? "Listening…" : "Hold to talk"}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-sm font-medium text-muted-soft">Audio playback</span>
              <span className="text-xs text-muted-soft/80">
                Hear the tutor through your speakers.
              </span>
            </div>
            <SwitchControl
              label="Toggle audio playback"
              checked={isAudioPlaybackEnabled}
              onToggle={setIsAudioPlaybackEnabled}
              disabled={!isConnected}
            />
            <span className="text-xs font-semibold text-muted-soft">
              {isAudioPlaybackEnabled ? "On" : "Muted"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-sm font-medium text-muted-soft">Session logs</span>
              <span className="text-xs text-muted-soft/80">
                Keep an eye on live SDK events.
              </span>
            </div>
            <SwitchControl
              label="Toggle session logs"
              checked={isEventsPaneExpanded}
              onToggle={setIsEventsPaneExpanded}
            />
            <span
              className={`text-xs font-semibold ${
                isEventsPaneExpanded ? "text-emerald-600" : "text-muted-soft"
              }`}
            >
              {isEventsPaneExpanded ? "Visible" : "Hidden"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-sm font-medium text-muted-soft">Audio quality</span>
              <span className="text-xs text-muted-soft/80">
                Choose the best fit for your connection.
              </span>
            </div>
            <div className="inline-flex flex-wrap items-stretch overflow-hidden rounded-full border border-border bg-card/80">
              {codecOptions.map((option) => {
                const isActive = codec === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleCodecSelect(option.value)}
                    className={`flex flex-col px-3 py-2 text-left transition ${
                      isActive
                        ? "bg-foreground text-background"
                        : "text-muted-soft hover:text-foreground"
                    }`}
                    aria-pressed={isActive}
                    title={`${option.label} – ${option.helper}`}
                  >
                    <span className="text-sm font-semibold leading-tight">
                      {option.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide">
                      {option.helper}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BottomToolbar;

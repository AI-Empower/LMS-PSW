// src/app/components/Transcript.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Image from "next/image";
import { DownloadIcon, ClipboardCopyIcon } from "@radix-ui/react-icons";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import type { TranscriptItem } from "@/app/types";
import { GuardrailChip } from "./GuardrailChip";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((n, i) => {
      const o = prevLogs[i];
      return o && (n.title !== o.title || n.data !== o.data);
    });
    if (hasNewMessage || hasUpdatedMessage) scrollToBottom();
    setPrevLogs(transcriptItems);
  }, [transcriptItems, prevLogs]);

  useEffect(() => {
    if (canSend && inputRef.current) inputRef.current.focus();
  }, [canSend]);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy transcript:", err);
    }
  };

  return (
    // ⬇️ Same layout: column, fills available space, rounded, themed surface
    <div className="flex flex-col flex-1 min-h-0 rounded-xl bg-card border border-border">
      {/* Header (sticky) */}
      <div className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 text-base border-b border-border bg-card rounded-t-xl">
        <span className="font-semibold text-foreground">Transcript</span>
        <div className="flex gap-x-2">
          <button
            type="button"
            onClick={handleCopyTranscript}
            className="w-24 text-sm px-3 py-1 rounded-md bg-background text-foreground border border-border hover:bg-card focus:outline-none focus:ring-1 focus:ring-accent flex items-center justify-center gap-x-1"
          >
            <ClipboardCopyIcon />
            {justCopied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={downloadRecording}
            className="w-40 text-sm px-3 py-1 rounded-md bg-background text-foreground border border-border hover:bg-card focus:outline-none focus:ring-1 focus:ring-accent flex items-center justify-center gap-x-1"
          >
            <DownloadIcon />
            <span>Download Audio</span>
          </button>
        </div>
      </div>

      {/* Transcript Content (scrolling pane) */}
      {/* ⬇️ IMPORTANT: flex-1 min-h-0 restores scroll; no functionality change */}
      <div
        ref={transcriptRef}
        className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-y-4"
      >
        {[...transcriptItems]
          .sort((a, b) => a.createdAtMs - b.createdAtMs)
          .map((item) => {
            const {
              itemId,
              type,
              role,
              data,
              expanded,
              timestamp,
              title = "",
              isHidden,
              guardrailResult,
            } = item;

            if (isHidden) return null;

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const container = `flex justify-end flex-col ${isUser ? "items-end" : "items-start"
                }`;
              // Only theming: user = high contrast; assistant = subtle panel
              const bubble =
                isUser
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground border border-border";

              const bracketed = title.startsWith("[") && title.endsWith("]");
              const messageStyle = bracketed ? "italic text-muted" : "";
              const displayTitle = bracketed ? title.slice(1, -1) : title;

              return (
                <div key={itemId} className={container}>
                  <div className="max-w-lg">
                    <div
                      className={`${bubble} rounded-t-xl ${guardrailResult ? "" : "rounded-b-xl"
                        } p-3`}
                    >
                      <div className="text-xs text-muted font-mono">
                        {timestamp}
                      </div>
                      <div className={`whitespace-pre-wrap ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-background border-x border-b border-border px-3 py-2 rounded-b-xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (type === "BREADCRUMB") {
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-muted text-sm"
                >
                  <span className="text-xs font-mono">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-foreground ${data ? "cursor-pointer" : ""
                      }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-muted mr-1 transform transition-transform duration-200 select-none font-mono ${expanded ? "rotate-90" : "rotate-0"
                          }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-foreground text-left">
                      <pre className="border-l-2 ml-1 border-border whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={itemId}
                className="flex justify-center text-muted text-sm italic font-mono"
              >
                Unknown item type: {item.type}{" "}
                <span className="ml-2 text-xs">{timestamp}</span>
              </div>
            );
          })}
      </div>

      {/* Footer / Compose Bar (fixed height, never scrolls) */}
      <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-border bg-card rounded-b-xl">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) onSendMessage();
          }}
          className="flex-1 px-4 py-2 bg-background text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Type a message..."
          aria-label="Type a message"
        />
        <button
          type="button"
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="p-2 rounded-md border border-border bg-background text-foreground hover:bg-card focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Image src="/arrow.svg" alt="Send" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;
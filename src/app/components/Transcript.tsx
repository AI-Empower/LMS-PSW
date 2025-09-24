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
    const hasUpdatedMessage = transcriptItems.some((nextItem, index) => {
      const previous = prevLogs[index];
      return previous && (nextItem.title !== previous.title || nextItem.data !== previous.data);
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
    <div className="flex flex-col flex-1 min-h-0 rounded-lg-theme border border-border bg-card/95 shadow-soft backdrop-blur-sm">
      <div className="flex flex-wrap gap-3 items-center justify-between px-5 py-3 sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm rounded-t-lg">
        <span className="font-semibold text-lg text-foreground">Transcript</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyTranscript}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-full bg-accent-soft text-accent hover:bg-accent-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
          >
            <ClipboardCopyIcon />
            {justCopied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={downloadRecording}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm hover:from-emerald-500/90 hover:to-emerald-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
          >
            <DownloadIcon />
            <span>Download Audio</span>
          </button>
        </div>
      </div>

      <div ref={transcriptRef} className="flex-1 min-h-0 overflow-auto px-5 py-4 flex flex-col gap-4">
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
              const container = `flex flex-col ${isUser ? "items-end" : "items-start"}`;
              const bubble = isUser
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md"
                : "bg-card/90 text-foreground border border-border/70 shadow-sm";

              const bracketed = title.startsWith("[") && title.endsWith("]");
              const messageStyle = bracketed ? "italic text-muted" : "";
              const displayTitle = bracketed ? title.slice(1, -1) : title;

              return (
                <div key={itemId} className={container}>
                  <div className="max-w-xl">
                    <div className={`${bubble} rounded-3xl px-4 py-3 space-y-2`}> 
                      <div className="text-xs font-mono text-muted-soft">{timestamp}</div>
                      <div className={`whitespace-pre-wrap ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-card/90 border-x border-b border-border px-4 py-2 rounded-b-3xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (type === "BREADCRUMB") {
              return (
                <div key={itemId} className="flex flex-col items-start text-sm text-muted">
                  <span className="text-xs font-mono text-muted-soft">{timestamp}</span>
                  <div
                    className={`mt-1 whitespace-pre-wrap flex items-center font-mono text-sm text-foreground ${
                      data ? "cursor-pointer" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`mr-2 text-accent transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        {'>'}
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-foreground text-left w-full">
                      <pre className="border-l-2 ml-1 border-border whitespace-pre-wrap break-words font-mono text-xs my-2 pl-3">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={itemId} className="flex justify-center text-muted text-sm italic font-mono">
                Unknown item type: {item.type}
                <span className="ml-2 text-xs text-muted-soft">{timestamp}</span>
              </div>
            );
          })}
      </div>

      <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-t border-border bg-card/95 backdrop-blur-sm rounded-b-lg">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) onSendMessage();
          }}
          className="flex-1 min-w-[200px] px-4 py-2 rounded-full border border-transparent bg-accent-soft/70 text-foreground placeholder:text-muted focus:bg-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="Type a message..."
          aria-label="Type a message"
        />
        <button
          type="button"
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="inline-flex items-center justify-center p-2 rounded-full bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <Image src="/arrow.svg" alt="Send" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;





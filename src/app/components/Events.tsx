// src/app/components/Events.tsx
"use client";

import React, { useEffect, useRef } from "react";
import { useEvent } from "@/app/contexts/EventContext";

export interface EventsProps {
  isExpanded: boolean;
}

function Events({ isExpanded }: EventsProps) {
  const eventLogsContainerRef = useRef<HTMLDivElement | null>(null);
  const previousCountRef = useRef<number>(0);
  const previousExpandedRef = useRef<boolean>(isExpanded);
  const { loggedEvents, toggleExpand } = useEvent();

  const getDirectionMeta = (direction: string) => {
    switch (direction) {
      case "client":
        return {
          label: "Student",
          badgeClass:
            "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30",
        };
      case "server":
        return {
          label: "Tutor",
          badgeClass: "bg-sky-500/10 text-sky-600 border border-sky-500/30",
        };
      default:
        return {
          label: "System",
          badgeClass:
            "bg-slate-500/10 text-slate-500 border border-slate-500/30",
        };
    }
  };

  useEffect(() => {
    const container = eventLogsContainerRef.current;
    const hasNewEvent = loggedEvents.length > previousCountRef.current;
    const expandedJustNow = isExpanded && !previousExpandedRef.current;

    if (container && isExpanded && (hasNewEvent || expandedJustNow)) {
      container.scrollTop = container.scrollHeight;
    }

    previousExpandedRef.current = isExpanded;
    previousCountRef.current = loggedEvents.length;
  }, [loggedEvents, isExpanded]);

  if (!isExpanded) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-8 text-center text-sm text-muted-soft">
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground/80">
            Session logs hidden
          </p>
          <p>
            Turn on <span className="font-medium text-foreground">Session logs</span> in
            the toolbar to monitor real-time activity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span
            className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"
            aria-hidden="true"
          />
          Stream events
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-mono font-semibold text-emerald-600">
            {loggedEvents.length}
          </span>
        </div>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-soft">
          Live
        </span>
      </div>
      <div
        ref={eventLogsContainerRef}
        className="flex-1 overflow-auto px-5 py-4 space-y-3"
      >
        {loggedEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg-theme border border-dashed border-border/70 bg-card/70 px-6 py-10 text-sm text-muted-soft">
            <p>No events yet. Interact with the tutor to populate this feed.</p>
          </div>
        ) : (
          loggedEvents.map((log) => {
            const { badgeClass, label } = getDirectionMeta(log.direction);
            const isError =
              log.eventName?.toLowerCase().includes("error") ||
              log.eventData?.response?.status_details?.error != null;
            const hasPayload =
              log.eventData && Object.keys(log.eventData).length > 0;

            return (
              <div
                key={log.id}
                className="rounded-lg-theme border border-border/70 bg-card/90 px-4 py-3 shadow-soft transition-colors hover:border-accent/50"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(log.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                  aria-expanded={log.expanded}
                >
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
                    >
                      <span
                        className="h-2 w-2 rounded-full bg-current"
                        aria-hidden="true"
                      />
                      {label}
                    </span>
                    <span
                      className={`flex-1 text-sm ${
                        isError ? "text-rose-500" : "text-foreground"
                      }`}
                    >
                      {log.eventName || "Unnamed event"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 pl-3 text-xs text-muted-soft">
                    <span className="font-mono">{log.timestamp}</span>
                    {hasPayload && (
                      <svg
                        className={`h-3.5 w-3.5 transition-transform ${
                          log.expanded ? "rotate-180" : ""
                        }`}
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 8l5 5 5-5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
                {log.expanded && hasPayload && (
                  <pre className="mt-3 max-h-60 overflow-auto rounded-lg-theme border border-border/60 bg-card/95 p-3 font-mono text-xs text-foreground">
                    {JSON.stringify(log.eventData, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default Events;

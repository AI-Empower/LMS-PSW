// src/app/components/Events.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEvent } from "@/app/contexts/EventContext";
import { LoggedEvent } from "@/app/types";

export interface EventsProps {
  isExpanded: boolean;
}

function Events({ isExpanded }: EventsProps) {
  const [prevEventLogs, setPrevEventLogs] = useState<LoggedEvent[]>([]);
  const eventLogsContainerRef = useRef<HTMLDivElement | null>(null);
  const { loggedEvents, toggleExpand } = useEvent();

  const getDirectionArrow = (direction: string) => {
    if (direction === "client") return { symbol: "▲", color: "#7f5af0" }; // purple
    if (direction === "server") return { symbol: "▼", color: "#2cb67d" }; // green
    return { symbol: "•", color: "#888" };
  };

  useEffect(() => {
    const hasNewEvent = loggedEvents.length > prevEventLogs.length;
    if (isExpanded && hasNewEvent && eventLogsContainerRef.current) {
      eventLogsContainerRef.current.scrollTop =
        eventLogsContainerRef.current.scrollHeight;
    }
    setPrevEventLogs(loggedEvents);
  }, [loggedEvents, isExpanded, prevEventLogs]);

  return (
    <div
      ref={eventLogsContainerRef}
      className={[
        // Base: acts as a column panel that can shrink and scroll
        "rounded-xl bg-card border border-border",
        "flex flex-col",            // column layout
        isExpanded ? "flex-1" : "flex-none",
        "min-h-0",                  // <-- allows inner overflow to work
        // Width/visibility toggle
        isExpanded
          ? "w-1/2 overflow-auto"   // scroll when expanded
          : "w-0 overflow-hidden opacity-0",
        "transition-all duration-200 ease-in-out",
      ].join(" ")}
    >
      {isExpanded && (
        <div className="flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 sticky top-0 z-10 text-base border-b border-border bg-card rounded-t-xl">
            <span className="font-semibold text-foreground">Logs</span>
          </div>

          {/* Events list */}
          <div className="flex-1 min-h-0">
            {loggedEvents.map((log, idx) => {
              const arrowInfo = getDirectionArrow(log.direction);
              const isError =
                log.eventName.toLowerCase().includes("error") ||
                log.eventData?.response?.status_details?.error != null;

              return (
                <div
                  key={`${log.id}-${idx}`}
                  className="border-t border-border py-2 px-6 font-mono"
                >
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center flex-1">
                      <span
                        style={{ color: arrowInfo.color }}
                        className="ml-1 mr-2 select-none"
                      >
                        {arrowInfo.symbol}
                      </span>
                      <span
                        className={
                          "flex-1 text-sm " +
                          (isError ? "text-red-500" : "text-foreground")
                        }
                      >
                        {log.eventName}
                      </span>
                    </div>
                    <div className="text-muted ml-1 text-xs whitespace-nowrap">
                      {log.timestamp}
                    </div>
                  </div>

                  {log.expanded && log.eventData && (
                    <div className="text-foreground text-left">
                      <pre className="border-l-2 ml-1 border-border whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(log.eventData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;
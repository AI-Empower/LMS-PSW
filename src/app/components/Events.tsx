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

  const getDirectionArrow = (direction: string) => {
    if (direction === "client") return { symbol: "->", color: "#1fbe78" };
    if (direction === "server") return { symbol: "<-", color: "#4c6ef5" };
    return { symbol: "..", color: "#94a3b8" };
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
    <div
      ref={eventLogsContainerRef}
      className={[
        "rounded-lg-theme border border-border bg-card/95 shadow-soft backdrop-blur-sm",
        "flex flex-col",
        isExpanded ? "flex-1" : "flex-none",
        "min-h-0",
        isExpanded ? "w-full overflow-auto" : "w-0 overflow-hidden opacity-0",
        "transition-all duration-200 ease-in-out",
      ].join(" ")}
    >
      {isExpanded && (
        <div className="flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-3 text-base border-b border-border bg-card/90 rounded-t-lg">
            <span className="font-semibold text-foreground">Session Logs</span>
            <span className="text-xs uppercase tracking-widest text-muted-soft">Live</span>
          </div>

          <div className="flex-1 min-h-0">
            {loggedEvents.map((log, idx) => {
              const arrowInfo = getDirectionArrow(log.direction);
              const isError =
                log.eventName.toLowerCase().includes("error") ||
                log.eventData?.response?.status_details?.error != null;

              return (
                <div
                  key={`${log.id}-${idx}`}
                  className="border-t border-border/70 px-5 py-3 font-mono text-sm hover:bg-accent-soft/50 transition-colors"
                >
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center flex-1 gap-3">
                      <span
                        style={{ color: arrowInfo.color }}
                        className="text-base select-none"
                      >
                        {arrowInfo.symbol}
                      </span>
                      <span
                        className={
                          "flex-1 truncate " +
                          (isError ? "text-red-500" : "text-foreground")
                        }
                      >
                        {log.eventName}
                      </span>
                    </div>
                    <div className="text-muted-soft ml-3 text-xs whitespace-nowrap">
                      {log.timestamp}
                    </div>
                  </div>

                  {log.expanded && log.eventData && (
                    <div className="text-foreground text-left">
                      <pre className="border-l-2 ml-1 border-border whitespace-pre-wrap break-words font-mono text-xs my-2 pl-3">
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




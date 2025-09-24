// src/app/components/PdfPane.tsx
"use client";

import React, { useMemo } from "react";

export type PdfPaneProps = {
  url: string;
  renderedPage: number;
  zoomPct: number;
  label?: string;
  className?: string;
};

export default function PdfPane({
  url,
  renderedPage,
  zoomPct,
  label = "Manual",
  className,
}: PdfPaneProps) {
  const src = useMemo(() => {
    const page = Math.max(1, Math.floor(renderedPage || 1));
    const zoom = Math.max(10, Math.floor(zoomPct || 80));
    return `${url}#page=${page}&zoom=${zoom}`;
  }, [url, renderedPage, zoomPct]);

  const containerClassName = [
    "flex flex-col flex-1 min-h-0 h-full rounded-lg-theme border border-border bg-card/95 shadow-soft backdrop-blur-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-accent-soft/60 rounded-t-lg">
        <span className="text-lg font-semibold text-foreground">{label}</span>
        <span className="text-xs uppercase tracking-widest text-muted-soft">
          Page {renderedPage} | {zoomPct}%
        </span>
      </div>
      <div className="flex-1 min-h-[280px] relative">
        <iframe
          key={`${renderedPage}-${zoomPct}`}
          title={label}
          src={src}
          className="w-full h-full rounded-b-lg"
          style={{ border: "none" }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-b-lg ring-1 ring-black/5" />
      </div>
    </div>
  );
}


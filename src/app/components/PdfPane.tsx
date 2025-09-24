// src/app/components/PdfPane.tsx
"use client";

import React, { useMemo } from "react";

export type PdfPaneProps = {
  url: string;
  renderedPage: number;
  zoomPct?: number;
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
  const normalizedZoom = useMemo(
    () => Math.max(10, Math.floor(zoomPct ?? 80)),
    [zoomPct]
  );

  const src = useMemo(() => {
    const page = Math.max(1, Math.floor(renderedPage || 1));
    const zoomParam = normalizedZoom <= 100 ? "page-fit" : String(normalizedZoom);
    return `${url}#page=${page}&zoom=${zoomParam}`;
  }, [url, renderedPage, normalizedZoom]);

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
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium uppercase tracking-widest text-accent hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-full px-3 py-1"
        >
          Open manual
        </a>
      </div>

      {/* Responsive wrapper:
          - Mobile: aspect-ratio box via padding-bottom
          - Desktop: real height via viewport units */}
      <div className="relative w-full pb-[140%] sm:pb-0 sm:h-[70vh] lg:h-[78vh] xl:h-[84vh]">
        <iframe
          key={`${renderedPage}-${zoomPct}`}
          title={label}
          src={src}
          className="absolute inset-0 w-full h-full rounded-b-lg"
          style={{ border: "none" }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-b-lg ring-1 ring-black/5" />
      </div>
    </div>
  );
}

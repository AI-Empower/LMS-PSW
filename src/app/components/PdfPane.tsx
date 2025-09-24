// src/app/components/PdfPane.tsx
"use client";

import React, { useMemo } from "react";

import { PdfZoomLevel } from "../contexts/PdfNavContext";

export type PdfPaneProps = {
  url: string;
  renderedPage: number;
  zoomSetting: PdfZoomLevel;
  label?: string;
  className?: string;
};

export default function PdfPane({
  url,
  renderedPage,
  zoomSetting,
  label = "Manual",
  className,
}: PdfPaneProps) {
  const src = useMemo(() => {
    const page = Math.max(1, Math.floor(renderedPage || 1));
    const zoomValue =
      typeof zoomSetting === "number"
        ? Math.max(10, Math.floor(zoomSetting || 80)).toString()
        : zoomSetting;

    const hashParts = [`page=${page}`];
    if (zoomValue) {
      hashParts.push(`zoom=${encodeURIComponent(zoomValue)}`);
    }

    return `${url}#${hashParts.join("&")}`;
  }, [url, renderedPage, zoomSetting]);

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
          rel="noopener noreferrer"
          className="text-xs font-medium uppercase tracking-wide text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-full px-3 py-1 transition-colors"
        >
          Open full screen
        </a>
      </div>
      <div className="flex-1 min-h-[280px] relative">
        <iframe
          key={`${renderedPage}-${zoomSetting}`}
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


// src/app/components/PdfPane.tsx
"use client";

import React, { useMemo } from "react";

export type PdfPaneProps = {
  url: string;
  renderedPage: number;  // final PDF page index (after applying your offset)
  zoomPct: number;       // e.g., 80
  label?: string;
};

export default function PdfPane({
  url,
  renderedPage,
  zoomPct,
  label = "Manual",
}: PdfPaneProps) {
  const src = useMemo(() => {
    const page = Math.max(1, Math.floor(renderedPage || 1));
    const zoom = Math.max(10, Math.floor(zoomPct || 80));
    // note: encode the % as %25 for fragment correctness
    return `${url}#page=${page}&zoom=${zoom}%25`;
  }, [url, renderedPage, zoomPct]);

  return (
    <div className="flex flex-col min-h-0 h-full rounded-xl bg-white border border-gray-200">
      <div className="px-3 py-2 border-b text-sm text-gray-600 flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-gray-400">
          Page {renderedPage} · {zoomPct}%
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <iframe
          key={`${renderedPage}-${zoomPct}`}
          title={label}
          src={src}
          className="w-full h-full"
          style={{ border: "none" }}
        />
      </div>
    </div>
  );
}
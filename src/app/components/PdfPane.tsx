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
    return `${url}#page=${page}&zoom=${zoom}%25`;
  }, [url, renderedPage, zoomPct]);

  return (
    <iframe
      key={`${renderedPage}-${zoomPct}`}
      title={label}
      src={src}
      className={`w-full h-full ${className ?? ""}`}
      style={{ border: "none" }}
      loading="lazy"
    />
  );
}


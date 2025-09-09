"use client";
import React, { createContext, useContext } from "react";

export type PdfNavContextType = {
  /** Navigate to a concrete PDF page (1-based, already mapped). */
  goToPage: (pdfPage: number) => void;
  /** Navigate using the manual's printed (logical) page number. */
  goToLogicalPage: (printedPage: number) => void;
  /** Set zoom percentage, e.g., 80. */
  setZoom: (zoomPercent: number) => void;
  /** Get/Set the page offset (pdf = printed + offset). */
  getOffset: () => number;
  setOffset: (offset: number) => void;
};

const PdfNavContext = createContext<PdfNavContextType | null>(null);

export function PdfNavProvider(
  props: React.PropsWithChildren<PdfNavContextType>
) {
  const { children, ...value } = props;
  return <PdfNavContext.Provider value={value}>{children}</PdfNavContext.Provider>;
}

export function usePdfNav() {
  const ctx = useContext(PdfNavContext);
  if (!ctx) throw new Error("usePdfNav must be used within PdfNavProvider");
  return ctx;
}
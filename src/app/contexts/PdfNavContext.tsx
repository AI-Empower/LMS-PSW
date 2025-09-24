"use client";
import React, { createContext, useContext } from "react";

export type PdfZoomLevel = number | "page-width" | "page-fit";

export type PdfNavContextType = {
  /** Navigate to a concrete PDF page (1-based, already mapped). */
  goToPage: (pdfPage: number) => void;
  /** Navigate using the manual's printed (logical) page number. */
  goToLogicalPage: (printedPage: number) => void;
  /**
   * Set zoom preference for the embedded PDF viewer.
   * Accepts either a numeric percentage or named options such as "page-width".
   */
  setZoom: (zoomPercent: PdfZoomLevel) => void;
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
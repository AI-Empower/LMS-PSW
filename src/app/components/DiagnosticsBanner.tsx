"use client";

import React from "react";
import { AlertCircle, Info, TriangleAlert, X } from "lucide-react";
import type { Diagnostic } from "../hooks/useMicrophoneDiagnostics";

interface DiagnosticsBannerProps {
  diagnostics: Diagnostic[];
  onDismiss?: (id: string) => void;
}

const severityStyles: Record<
  Diagnostic["severity"],
  { icon: React.ReactNode; border: string; accent: string }
> = {
  error: {
    icon: <TriangleAlert className="h-5 w-5 text-red-500" aria-hidden />,
    border: "border-red-400/60",
    accent: "bg-red-500/10 text-red-700",
  },
  warning: {
    icon: <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />,
    border: "border-amber-400/60",
    accent: "bg-amber-400/10 text-amber-700",
  },
  info: {
    icon: <Info className="h-5 w-5 text-sky-500" aria-hidden />,
    border: "border-sky-400/60",
    accent: "bg-sky-400/10 text-sky-700",
  },
};

function DiagnosticsBanner({ diagnostics, onDismiss }: DiagnosticsBannerProps) {
  if (!diagnostics.length) return null;

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      {diagnostics.map((diagnostic) => {
        const styles = severityStyles[diagnostic.severity];
        return (
          <div
            key={diagnostic.id}
            className={`rounded-lg-theme border ${styles.border} bg-card/95 backdrop-blur-sm shadow-soft px-4 py-3`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex items-center justify-center rounded-full ${styles.accent} p-1`}>
                {styles.icon}
              </span>
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-foreground">{diagnostic.message}</p>
                {diagnostic.description ? (
                  <p className="text-sm text-muted-soft">{diagnostic.description}</p>
                ) : null}
              </div>
              {onDismiss ? (
                <button
                  type="button"
                  onClick={() => onDismiss(diagnostic.id)}
                  className="ml-auto -mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-soft transition hover:bg-muted/20 hover:text-muted"
                  aria-label="Dismiss diagnostic"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default DiagnosticsBanner;

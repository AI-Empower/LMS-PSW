import { useEffect, useMemo, useState } from "react";
import type { Diagnostic } from "./useMicrophoneDiagnostics";

export function useNetworkDiagnostics() {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    return !navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return useMemo<Diagnostic[]>(() => {
    if (!isOffline) return [];

    return [
      {
        id: "network-offline",
        severity: "error",
        message: "You are offline.",
        description:
          "We can’t reach the internet. Reconnect to continue talking with the agent.",
      },
    ];
  }, [isOffline]);
}

export default useNetworkDiagnostics;

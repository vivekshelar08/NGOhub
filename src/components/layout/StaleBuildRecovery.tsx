"use client";

import { useEffect } from "react";

/**
 * After a deploy, cached client bundles may reference removed Server Action IDs.
 * Reload once so users pick up the latest build without a manual hard refresh.
 */
export function StaleBuildRecovery() {
  useEffect(() => {
    const key = "ngo-hub:stale-build-reload";

    function shouldReload(message: string) {
      return (
        message.includes("failed to find Server Action") ||
        (message.includes("Server Action") && message.includes("was not found"))
      );
    }

    function onError(event: ErrorEvent) {
      if (!shouldReload(event.message ?? "")) return;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "");
      if (!shouldReload(message)) return;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

/** Keeps the session alive without forcing a full RSC refresh (which resets client wizards). */
export function SessionRefresh() {
  useEffect(() => {
    void fetch("/api/auth/refresh");
  }, []);

  return null;
}

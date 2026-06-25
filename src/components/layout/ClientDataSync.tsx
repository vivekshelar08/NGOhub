"use client";

import { useEffect } from "react";
import { syncClientDataVersion } from "@/lib/client-data";

export function ClientDataSync() {
  useEffect(() => {
    syncClientDataVersion();
  }, []);
  return null;
}

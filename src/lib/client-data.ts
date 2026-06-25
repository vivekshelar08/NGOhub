import { ACTIVITIES_STORAGE_KEY } from "@/lib/activities";

/** Bump to wipe stale local demo projects/activities/donors on next dashboard visit. */
export const CLIENT_DATA_VERSION = 2;
const VERSION_KEY = "ngo-hub-client-data-version";

const STORAGE_KEYS = [
  "ngo-hub-projects",
  ACTIVITIES_STORAGE_KEY,
  "ngo-hub-donors",
] as const;

export function clearNgoHubClientData() {
  if (typeof window === "undefined") return;
  for (const key of STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

/** Runs once per browser when CLIENT_DATA_VERSION changes. */
export function syncClientDataVersion() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(VERSION_KEY);
  if (stored === String(CLIENT_DATA_VERSION)) return;
  clearNgoHubClientData();
  localStorage.setItem(VERSION_KEY, String(CLIENT_DATA_VERSION));
}

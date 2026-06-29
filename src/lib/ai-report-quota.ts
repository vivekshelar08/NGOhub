import { localDateKey } from "@/lib/hr-utils";

/** Max AI API calls per report type per user per day. */
export const AI_GENERATION_DAILY_LIMIT = 2;

export type AiReportQuotaScope = "field-today" | "impact-report" | "scope-report";

const COUNT_PREFIX = "ngo-ai-gen-count";
const CACHE_PREFIX = "ngo-ai-gen-cache";

function countStorageKey(scope: AiReportQuotaScope, userId: string): string {
  return `${COUNT_PREFIX}:${scope}:${userId}:${localDateKey()}`;
}

function cacheStorageKey(scope: AiReportQuotaScope, fingerprint: string): string {
  return `${CACHE_PREFIX}:${scope}:${fingerprint}`;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota or storage full */
  }
}

export function getAiGenerationCount(scope: AiReportQuotaScope, userId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = readStorage(countStorageKey(scope, userId));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function getRemainingAiGenerations(scope: AiReportQuotaScope, userId: string): number {
  return Math.max(0, AI_GENERATION_DAILY_LIMIT - getAiGenerationCount(scope, userId));
}

export function canGenerateWithAi(scope: AiReportQuotaScope, userId: string): boolean {
  return getAiGenerationCount(scope, userId) < AI_GENERATION_DAILY_LIMIT;
}

export function recordAiGeneration(scope: AiReportQuotaScope, userId: string): number {
  if (typeof window === "undefined") return AI_GENERATION_DAILY_LIMIT;
  const next = getAiGenerationCount(scope, userId) + 1;
  writeStorage(countStorageKey(scope, userId), String(next));
  return next;
}

export function getCachedAiReport<T>(scope: AiReportQuotaScope, fingerprint: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readStorage(cacheStorageKey(scope, fingerprint));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setCachedAiReport<T>(scope: AiReportQuotaScope, fingerprint: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    writeStorage(cacheStorageKey(scope, fingerprint), JSON.stringify(data));
  } catch {
    /* quota or storage full — ignore */
  }
}

export function aiQuotaMessage(scope: AiReportQuotaScope, userId: string): string {
  const remaining = getRemainingAiGenerations(scope, userId);
  if (remaining <= 0) {
    return `Daily AI limit reached (${AI_GENERATION_DAILY_LIMIT}/${AI_GENERATION_DAILY_LIMIT}). Showing saved or classic report.`;
  }
  return `${remaining} AI generation${remaining === 1 ? "" : "s"} left today.`;
}

/** Stable key from today's field tasks. */
export function fieldTodayFingerprint(
  userId: string,
  mode: string,
  taskIds: string[]
): string {
  return `${userId}:${mode}:${[...taskIds].sort().join(",")}:${localDateKey()}`;
}

/** Stable key from impact report filters. */
export function impactReportFingerprint(filters: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.keys(filters)
    .sort()
    .map((k) => `${k}=${String(filters[k] ?? "")}`);
  return `${parts.join("&")}:${localDateKey()}`;
}

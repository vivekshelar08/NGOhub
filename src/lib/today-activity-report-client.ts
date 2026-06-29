"use client";

import { ActivityTask } from "@/lib/activities";
import { fetchJson } from "@/lib/fetch-json";
import { DEFAULT_ORG_SETTINGS } from "@/lib/orgSettings";
import {
  buildClassicTodayReportFromTasks,
  serializeTaskForReport,
  TodayActivityReportMode,
  TodayActivityReportResult,
} from "@/lib/today-activity-report";

/** Try AI via API; on any failure use the original classic WhatsApp share report. */
export async function fetchTodayActivityReportWithFallback(
  tasks: ActivityTask[],
  userName: string,
  mode: TodayActivityReportMode,
  orgName = DEFAULT_ORG_SETTINGS.orgName,
  options?: { aiTimeoutMs?: number }
): Promise<{ report: TodayActivityReportResult; notice?: string }> {
  const classic = buildClassicTodayReportFromTasks(tasks, userName, mode, orgName);

  if (tasks.length === 0) {
    return { report: classic };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    options?.aiTimeoutMs ?? 20_000
  );

  try {
    const data = await fetchJson<TodayActivityReportResult>("/api/reports/today-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        userName,
        orgName,
        mode,
        tasks: tasks.map(serializeTaskForReport),
      }),
    });

    if (data.provider === "template" || data.usedClassicFallback) {
      return {
        report: classic,
        notice: "AI unavailable — using classic WhatsApp report.",
      };
    }

    return { report: { ...data, usedClassicFallback: false } };
  } catch {
    return {
      report: classic,
      notice: "AI or server unavailable — using classic WhatsApp report (same as before).",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Instant classic report — no network, no AI (original share behaviour). */
export function classicTodayReportInstant(
  tasks: ActivityTask[],
  userName: string,
  mode: TodayActivityReportMode,
  orgName = DEFAULT_ORG_SETTINGS.orgName
): TodayActivityReportResult {
  return buildClassicTodayReportFromTasks(tasks, userName, mode, orgName);
}

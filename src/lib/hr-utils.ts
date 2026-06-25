/** Serialize Prisma Decimal fields for JSON responses. */
export function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

/** Start of today in local timezone as UTC date-only. */
export function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** YYYY-MM-DD for a local calendar date (avoids toISOString timezone shifts). */
export function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Format a YYYY-MM-DD key for display without timezone shift. */
export function formatDateKey(
  dateKey: string,
  locale = "en-IN",
  options?: Intl.DateTimeFormatOptions
): string {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString(locale, options);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function eachDateKey(from: string, to: string): string[] {
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    cursor = addDaysToDateKey(cursor, 1);
  }
  return keys;
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LEAVE: "Leave",
  HALF_DAY: "Half day",
};

export const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PROCESSED: "Processed",
  PAID: "Paid",
};

export const RATING_LABELS: Record<number, string> = {
  1: "Needs improvement",
  2: "Below expectations",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};

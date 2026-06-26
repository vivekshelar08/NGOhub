/** Organization timezone — all attendance dates and punch times use IST (Kolkata). */
export const APP_TIMEZONE = "Asia/Kolkata";

/** Serialize Prisma Decimal fields for JSON responses. */
export function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

/** YYYY-MM-DD for a calendar date in Kolkata timezone. */
export function localDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Start of today in Kolkata as UTC date-only (for DB @db.Date fields). */
export function todayDateOnly(): Date {
  return parseDateOnly(localDateKey());
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

/** Format punch timestamp in Kolkata timezone. */
export function formatTimeKolkata(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleTimeString("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format full date-time in Kolkata timezone. */
export function formatDateTimeKolkata(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleString("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
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

/** Days in a month as YYYY-MM-DD keys (Kolkata calendar month). */
export function daysInMonth(year: number, month: number): string[] {
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
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

import { HolidayType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const CALENDAR_BHARAT_BASE = "https://jayantur13.github.io/calendar-bharat/calendar";

type CalendarBharatEvent = {
  event: string;
  type: string;
  extras?: string;
};

type CalendarBharatYear = Record<string, Record<string, CalendarBharatEvent>>;

function mapEventType(rawType: string): HolidayType {
  const normalized = rawType.toLowerCase();
  if (normalized.includes("government")) return "NATIONAL";
  if (normalized.includes("festival") || normalized.includes("religional")) return "FESTIVAL";
  if (normalized.includes("good to know")) return "OBSERVANCE";
  return "RELIGIOUS";
}

function parseCalendarBharatDateKey(key: string): string | null {
  const match = key.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (!match) return null;
  const [, monthName, day, year] = match;
  const parsed = new Date(`${monthName} ${day}, ${year}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function fetchCalendarBharatYear(year: number) {
  const response = await fetch(`${CALENDAR_BHARAT_BASE}/${year}.json`, {
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Indian calendar for ${year}`);
  }

  const payload = (await response.json()) as Record<string, CalendarBharatYear>;
  const yearData = payload[String(year)];
  if (!yearData) return [];

  const holidays: Array<{
    date: Date;
    name: string;
    type: HolidayType;
    year: number;
    source: string;
    details: string | null;
  }> = [];

  for (const monthBlock of Object.values(yearData)) {
    for (const [dateKey, event] of Object.entries(monthBlock)) {
      const isoDate = parseCalendarBharatDateKey(dateKey);
      if (!isoDate) continue;

      holidays.push({
        date: new Date(`${isoDate}T00:00:00.000Z`),
        name: event.event,
        type: mapEventType(event.type),
        year,
        source: "calendar-bharat",
        details: event.extras ?? null,
      });
    }
  }

  return holidays;
}

export async function getIndianHolidaysForYear(year: number) {
  const cached = await prisma.publicHoliday.findMany({
    where: { year, source: "calendar-bharat" },
    orderBy: { date: "asc" },
  });

  if (cached.length > 0) {
    return cached;
  }

  const fetched = await fetchCalendarBharatYear(year);

  if (fetched.length === 0) {
    return [];
  }

  await prisma.publicHoliday.createMany({
    data: fetched,
    skipDuplicates: true,
  });

  return prisma.publicHoliday.findMany({
    where: { year, source: "calendar-bharat" },
    orderBy: { date: "asc" },
  });
}

export async function getIndianHolidaysInRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const years = new Set<number>();

  for (let year = fromDate.getUTCFullYear(); year <= toDate.getUTCFullYear(); year++) {
    years.add(year);
  }

  for (const year of years) {
    await getIndianHolidaysForYear(year);
  }

  return prisma.publicHoliday.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
  });
}

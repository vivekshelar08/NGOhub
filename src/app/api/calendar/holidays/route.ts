import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getIndianHolidaysForYear, getIndianHolidaysInRange } from "@/lib/indian-holidays";
import { hasFeature } from "@/lib/role-features";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "calendar.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    if (from && to) {
      const holidays = await getIndianHolidaysInRange(from, to);
      return NextResponse.json({
        holidays: holidays.map((h) => ({
          id: h.id,
          date: h.date.toISOString().slice(0, 10),
          name: h.name,
          type: h.type,
          details: h.details,
        })),
      });
    }

    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const holidays = await getIndianHolidaysForYear(year);
    return NextResponse.json({
      year,
      holidays: holidays.map((h) => ({
        id: h.id,
        date: h.date.toISOString().slice(0, 10),
        name: h.name,
        type: h.type,
        details: h.details,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load holidays";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { punchSchema } from "@/lib/validators";
import { todayDateOnly } from "@/lib/hr-utils";
import { isPrismaSchemaMismatch, schemaMismatchMessage } from "@/lib/api-db-safe";
import { performPunchIn, performPunchOut } from "@/lib/attendance-punch-server";
import type { PunchLocationType } from "@/lib/field-work";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.punch")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = punchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const today = todayDateOnly();
  const now = new Date();
  const locationType = parsed.data.locationType as PunchLocationType | undefined;
  const gps =
    parsed.data.latitude != null && parsed.data.longitude != null
      ? { latitude: parsed.data.latitude, longitude: parsed.data.longitude, locationType }
      : undefined;

  try {
    if (parsed.data.action === "in") {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { userId_date: { userId: currentUser.id, date: today } },
      });

      if (existing?.punchIn) {
        return NextResponse.json({ error: "Already punched in today" }, { status: 409 });
      }

      if (existing?.status === "LEAVE") {
        return NextResponse.json(
          { error: "You are marked on leave today. Request a correction if this is wrong." },
          { status: 403 }
        );
      }

      const record = await performPunchIn(prisma, currentUser.id, today, now, gps);

      return NextResponse.json({
        record,
        lateInfo: record.isLateMark
          ? { message: `Late by ${record.lateMinutes} minutes`, status: record.status }
          : null,
      });
    }

    const record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: currentUser.id, date: today } },
    });

    if (!record?.punchIn) {
      return NextResponse.json({ error: "Punch in first before punching out" }, { status: 400 });
    }

    if (record.punchOut) {
      return NextResponse.json({ error: "Already punched out today" }, { status: 409 });
    }

    const updated = await performPunchOut(prisma, record.id, now, gps);

    return NextResponse.json({ record: updated });
  } catch (error) {
    console.error("[POST /api/hr/attendance/punch]", error);
    if (isPrismaSchemaMismatch(error)) {
      return NextResponse.json({ error: schemaMismatchMessage() }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Punch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

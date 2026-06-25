import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { punchSchema } from "@/lib/validators";
import { todayDateOnly } from "@/lib/hr-utils";
import {
  computeLateStatus,
  ensureHrPolicySettings,
  resolveLateMarkSettings,
  serializePolicyFromDb,
} from "@/lib/hr-profile";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.punch")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = punchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const today = todayDateOnly();
  const now = new Date();

  await ensureHrPolicySettings(prisma);
  const orgPolicy = serializePolicyFromDb(
    await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } })
  );

  const profile = await prisma.employeeProfile.findUnique({
    where: { userId: currentUser.id },
  });

  const lateSettings = resolveLateMarkSettings(profile, orgPolicy);

  if (parsed.data.action === "in") {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: currentUser.id, date: today } },
    });

    if (existing?.punchIn) {
      return NextResponse.json({ error: "Already punched in today" }, { status: 409 });
    }

    const late = computeLateStatus(now, lateSettings);

    const record = await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: currentUser.id, date: today } },
      create: {
        userId: currentUser.id,
        date: today,
        punchIn: now,
        status: late.status,
        lateMinutes: late.lateMinutes,
        isLateMark: late.isLateMark,
      },
      update: {
        punchIn: now,
        status: late.status,
        lateMinutes: late.lateMinutes,
        isLateMark: late.isLateMark,
      },
    });

    return NextResponse.json({
      record,
      lateInfo: late.isLateMark
        ? { message: `Late by ${late.lateMinutes} minutes`, status: late.status }
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

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: { punchOut: now },
  });

  return NextResponse.json({ record: updated });
}

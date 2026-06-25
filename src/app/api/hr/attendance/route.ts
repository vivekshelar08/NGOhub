import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { todayDateOnly } from "@/lib/hr-utils";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.attendance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const month = searchParams.get("month");
  const teamToday = searchParams.get("teamToday") === "1";
  const teamMonth = searchParams.get("teamMonth") === "1";

  const canViewAll = hasFeature(currentUser.role, "hr.manage");

  if (teamToday && canViewAll) {
    const today = todayDateOnly();
    const records = await prisma.attendanceRecord.findMany({
      where: { date: today },
      include: {
        user: { select: { id: true, name: true, email: true, department: true, role: true } },
      },
      orderBy: { punchIn: "asc" },
    });
    return NextResponse.json({ records, todayRecord: null });
  }

  if (teamMonth && month && canViewAll) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 0));

    const records = await prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: [{ date: "desc" }, { punchIn: "desc" }],
    });
    return NextResponse.json({ records, todayRecord: null });
  }

  const targetUserId = userId && canViewAll ? userId : currentUser.id;

  const where: { userId: string; date?: { gte: Date; lte: Date } } = { userId: targetUserId };

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 0));
    where.date = { gte: start, lte: end };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { date: "desc" },
  });

  const today = todayDateOnly();

  const todayRecord =
    records.find((r) => r.date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10)) ??
    (targetUserId === currentUser.id
      ? await prisma.attendanceRecord.findUnique({
          where: { userId_date: { userId: currentUser.id, date: today } },
        })
      : null);

  return NextResponse.json({ records, todayRecord });
}

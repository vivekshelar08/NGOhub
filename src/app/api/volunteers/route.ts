import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

const volunteerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  skills: z.string().optional(),
  location: z.string().optional(),
});

const hoursSchema = z.object({
  volunteerId: z.string().uuid(),
  hours: z.number().positive(),
  activityDate: z.string(),
  activityTaskId: z.string().optional(),
  projectId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "activities.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const volunteers = await prisma.volunteer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      hours: {
        orderBy: { activityDate: "desc" },
        take: 5,
      },
      _count: { select: { hours: true } },
    },
  });

  const withTotals = volunteers.map((v) => ({
    id: v.id,
    name: v.name,
    phone: v.phone,
    email: v.email,
    skills: v.skills,
    location: v.location,
    isActive: v.isActive,
    totalHours: v.hours.reduce((s, h) => s + Number(h.hours), 0),
    recentHours: v.hours.map((h) => ({
      ...h,
      hours: Number(h.hours),
      activityDate: h.activityDate.toISOString().slice(0, 10),
    })),
    logCount: v._count.hours,
  }));

  return NextResponse.json({ volunteers: withTotals });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "activities.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "log_hours") {
    const parsed = hoursSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid hours log" }, { status: 400 });
    }
    const log = await prisma.volunteerHour.create({
      data: {
        ...parsed.data,
        activityDate: new Date(parsed.data.activityDate),
        recordedById: user.id,
      },
    });
    return NextResponse.json({
      hour: {
        ...log,
        hours: Number(log.hours),
        activityDate: log.activityDate.toISOString().slice(0, 10),
      },
    });
  }

  const parsed = volunteerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid volunteer" }, { status: 400 });
  }

  const volunteer = await prisma.volunteer.create({ data: parsed.data });
  return NextResponse.json({ volunteer });
}

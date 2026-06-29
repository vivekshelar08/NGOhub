import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { listVolunteerPipeline, convertVolunteerToStaffInvite, updateVolunteerEnrollment } from "@/lib/volunteer-pipeline";
import { VolunteerEnrollmentStatus } from "@/generated/prisma/enums";
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

  const volunteers = await listVolunteerPipeline(prisma);

  return NextResponse.json({
    volunteers: volunteers.map((v) => ({
      id: v.id,
      name: v.name,
      phone: v.phone,
      email: v.email,
      skills: v.skills,
      location: v.location,
      isActive: v.isActive,
      enrollmentStatus: v.enrollmentStatus,
      totalHours: v.totalHours,
      logCount: v.hoursLogged,
      recentHours: v.hours.map((h) => ({
        ...h,
        hours: Number(h.hours),
        activityDate: h.activityDate.toISOString().slice(0, 10),
      })),
    })),
  });
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

  if (body.action === "update_enrollment") {
    const parsed = z
      .object({
        volunteerId: z.string(),
        status: z.enum(["APPLIED", "ACTIVE", "INACTIVE", "CONVERTED_TO_STAFF"]),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    const v = await updateVolunteerEnrollment(prisma, parsed.data.volunteerId, parsed.data.status as VolunteerEnrollmentStatus);
    return NextResponse.json({ volunteer: v });
  }

  if (body.action === "convert_to_staff") {
    const parsed = z.object({ volunteerId: z.string() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    try {
      const result = await convertVolunteerToStaffInvite(prisma, parsed.data.volunteerId, user.id);
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
    }
  }

  const parsed = volunteerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid volunteer" }, { status: 400 });
  }

  const volunteer = await prisma.volunteer.create({ data: parsed.data });
  return NextResponse.json({ volunteer });
}

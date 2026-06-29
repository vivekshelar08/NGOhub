import { PrismaClient } from "@/generated/prisma/client";
import { VolunteerEnrollmentStatus } from "@/generated/prisma/enums";

export async function updateVolunteerEnrollment(
  prisma: PrismaClient,
  volunteerId: string,
  status: VolunteerEnrollmentStatus
) {
  return prisma.volunteer.update({
    where: { id: volunteerId },
    data: {
      enrollmentStatus: status,
      isActive: status === VolunteerEnrollmentStatus.ACTIVE,
    },
  });
}

export async function convertVolunteerToStaffInvite(
  prisma: PrismaClient,
  volunteerId: string,
  createdById: string,
  role: "STAFF" | "COORDINATOR" = "STAFF"
) {
  const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer) throw new Error("Volunteer not found");
  if (!volunteer.email) throw new Error("Volunteer needs an email for staff conversion");

  const token = `enr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const invite = await prisma.enrollmentInvite.create({
    data: {
      token,
      email: volunteer.email,
      name: volunteer.name,
      role,
      expiresAt: new Date(Date.now() + 14 * 86400000),
      createdById,
      employeePreset: { skills: volunteer.skills, location: volunteer.location },
    },
  });

  await prisma.volunteer.update({
    where: { id: volunteerId },
    data: { enrollmentStatus: VolunteerEnrollmentStatus.CONVERTED_TO_STAFF },
  });

  return { invite, enrollmentUrl: `/enroll/${token}` };
}

export async function listVolunteerPipeline(prisma: PrismaClient) {
  const volunteers = await prisma.volunteer.findMany({
    include: {
      hours: { orderBy: { activityDate: "desc" }, take: 5 },
      _count: { select: { hours: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return volunteers.map((v) => ({
    ...v,
    totalHours: v.hours.reduce((s, h) => s + Number(h.hours), 0),
    hoursLogged: v._count.hours,
  }));
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/hr-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile, dbUser] = await Promise.all([
    prisma.employeeProfile.findUnique({ where: { userId: user.id } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true, department: true },
    }),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: dbUser?.phone ?? null,
      role: user.role,
      department: dbUser?.department ?? null,
    },
    profile: profile
      ? {
          designation: profile.designation,
          employeeCode: profile.employeeCode,
          joinDate: profile.joinDate?.toISOString() ?? null,
          workLocation: profile.workLocation,
          baseSalary: decimalToNumber(profile.baseSalary),
          dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
          gender: profile.gender,
          maritalStatus: profile.maritalStatus,
          permanentAddress: profile.permanentAddress,
          currentAddress: profile.currentAddress,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone,
          panNumber: profile.panNumber,
        }
      : null,
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { employeeProfileSchema, updateEmployeeProfileSchema } from "@/lib/validators";
import { serializeEmployeeProfile, initLeaveBalance, toInputJson } from "@/lib/hr-profile";
import { LeaveSettings } from "@/lib/hr-types";

function buildUpsertData(userId: string, data: ReturnType<typeof employeeProfileSchema.parse>) {
  return {
    userId,
    employeeCode: data.employeeCode,
    designation: data.designation,
    joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
    confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : undefined,
    employmentType: data.employmentType,
    workLocation: data.workLocation,
    probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : undefined,
    fatherOrSpouseName: data.fatherOrSpouseName,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    gender: data.gender,
    maritalStatus: data.maritalStatus,
    nationality: data.nationality,
    bloodGroup: data.bloodGroup,
    permanentAddress: data.permanentAddress,
    currentAddress: data.currentAddress,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    panNumber: data.panNumber?.toUpperCase(),
    aadhaarNumber: data.aadhaarNumber,
    uanNumber: data.uanNumber,
    esicNumber: data.esicNumber,
    passportNumber: data.passportNumber,
    bankName: data.bankName,
    bankAccountNumber: data.bankAccountNumber,
    bankIfsc: data.bankIfsc?.toUpperCase(),
    bankAccountHolderName: data.bankAccountHolderName,
    ctc: data.ctc,
    basicSalary: data.basicSalary,
    hra: data.hra,
    conveyanceAllowance: data.conveyanceAllowance,
    specialAllowance: data.specialAllowance,
    baseSalary: data.baseSalary ?? data.basicSalary,
    payrollSettings: data.payroll ? toInputJson(data.payroll) : undefined,
    leaveSettings: data.leave ? toInputJson(data.leave) : undefined,
    lateMarkSettings: data.lateMark ? toInputJson(data.lateMark) : undefined,
  };
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      phone: true,
      status: true,
      createdAt: true,
      employeeProfile: { include: { user: { select: { department: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const staff = users.map((u) => ({
    ...u,
    employeeProfile: u.employeeProfile ? serializeEmployeeProfile(u.employeeProfile) : null,
  }));

  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = employeeProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { userId, department } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (department) {
    await prisma.user.update({ where: { id: userId }, data: { department } });
  }

  const upsertData = buildUpsertData(userId, parsed.data);
  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    create: upsertData,
    update: upsertData,
    include: { user: { select: { department: true } } },
  });

  if (parsed.data.leave) {
    await initLeaveBalance(prisma, profile.id, parsed.data.leave as LeaveSettings);
  }

  return NextResponse.json({ profile: serializeEmployeeProfile(profile) });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, department, ...updates } = body as { userId?: string; department?: string };
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const parsed = updateEmployeeProfileSchema.safeParse(updates);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  if (department) {
    await prisma.user.update({ where: { id: userId }, data: { department } });
  }

  const fullData = { userId, ...parsed.data };
  const validated = employeeProfileSchema.safeParse(fullData);
  if (!validated.success) {
    return NextResponse.json({ error: validated.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const upsertData = buildUpsertData(userId, validated.data);
  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    create: upsertData,
    update: upsertData,
    include: { user: { select: { department: true } } },
  });

  return NextResponse.json({ profile: serializeEmployeeProfile(profile) });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { hrPolicySchema } from "@/lib/validators";
import { ensureHrPolicySettings, serializePolicyFromDb } from "@/lib/hr-profile";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureHrPolicySettings(prisma);
  const settings = await prisma.hrPolicySettings.findUniqueOrThrow({ where: { id: "default" } });

  return NextResponse.json({ settings: serializePolicyFromDb(settings) });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = hrPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { payroll, leave, lateMark } = parsed.data;

  await ensureHrPolicySettings(prisma);
  const settings = await prisma.hrPolicySettings.update({
    where: { id: "default" },
    data: {
      payCycleDay: payroll.payCycleDay,
      pfEmployeePercent: payroll.pfEmployeePercent,
      pfEmployerPercent: payroll.pfEmployerPercent,
      esiEmployeePercent: payroll.esiEmployeePercent,
      esiEmployerPercent: payroll.esiEmployerPercent,
      professionalTax: payroll.professionalTax,
      tdsApplicable: payroll.tdsApplicable,
      casualLeaveDays: leave.casualLeaveDays,
      sickLeaveDays: leave.sickLeaveDays,
      earnedLeaveDays: leave.earnedLeaveDays,
      carryForwardEnabled: leave.carryForwardEnabled,
      maxCarryForwardDays: leave.maxCarryForwardDays,
      officeStartTime: lateMark.officeStartTime,
      officeEndTime: lateMark.officeEndTime,
      gracePeriodMins: lateMark.gracePeriodMins,
      lateMarkAfterMins: lateMark.lateMarkAfterMins,
      halfDayAfterMins: lateMark.halfDayAfterMins,
      maxLateMarksPerMonth: lateMark.maxLateMarksPerMonth,
      lateDeductionPerMark: lateMark.lateDeductionPerMark,
    },
  });

  return NextResponse.json({ settings: serializePolicyFromDb(settings) });
}

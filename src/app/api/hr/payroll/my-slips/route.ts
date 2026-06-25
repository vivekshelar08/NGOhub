import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { decimalToNumber } from "@/lib/hr-utils";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.attendance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lines = await prisma.payrollLine.findMany({
    where: {
      userId: currentUser.id,
      payrollRun: { status: { in: ["PROCESSED", "PAID"] } },
    },
    include: {
      payrollRun: {
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { payrollRun: { createdAt: "desc" } },
  });

  return NextResponse.json({
    slips: lines.map((line) => ({
      lineId: line.id,
      periodStart: line.payrollRun.periodStart.toISOString().slice(0, 10),
      periodEnd: line.payrollRun.periodEnd.toISOString().slice(0, 10),
      status: line.payrollRun.status,
      netPay: decimalToNumber(line.netPay),
      createdAt: line.payrollRun.createdAt.toISOString(),
    })),
  });
}

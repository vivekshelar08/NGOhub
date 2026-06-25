import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.payroll")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const run = await prisma.payrollRun.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  }

  const nextStatus =
    run.status === "DRAFT" ? "PROCESSED" : run.status === "PROCESSED" ? "PAID" : run.status;

  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: nextStatus },
  });

  if (nextStatus === "PAID") {
    const { ensureAccountingSetup, postPayrollJournal } = await import("@/lib/accounting");
    try {
      await ensureAccountingSetup(prisma);
      await postPayrollJournal(prisma, id, currentUser.id);
    } catch (error) {
      console.error("Payroll journal posting failed:", error);
    }
  }

  return NextResponse.json({ run: updated });
}

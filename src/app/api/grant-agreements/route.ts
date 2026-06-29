import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { parseDateOnly } from "@/lib/hr-utils";
import {
  createGrantAgreement,
  getDueTrancheReminders,
  listGrantAgreements,
} from "@/lib/grant-agreements";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("reminders") === "1") {
    const tranches = await getDueTrancheReminders(prisma);
    return NextResponse.json({
      tranches: tranches.map((t) => ({
        ...t,
        amount: Number(t.amount),
        dueDate: t.dueDate.toISOString().slice(0, 10),
        reportDueDate: t.reportDueDate?.toISOString().slice(0, 10) ?? null,
      })),
    });
  }

  const financeProjectId = searchParams.get("financeProjectId") ?? undefined;
  const agreements = await listGrantAgreements(prisma, financeProjectId);
  return NextResponse.json({
    agreements: agreements.map((a) => ({
      ...a,
      totalAmount: Number(a.totalAmount),
      startDate: a.startDate.toISOString().slice(0, 10),
      endDate: a.endDate.toISOString().slice(0, 10),
      tranches: a.tranches.map((t) => ({
        ...t,
        amount: Number(t.amount),
        dueDate: t.dueDate.toISOString().slice(0, 10),
        reportDueDate: t.reportDueDate?.toISOString().slice(0, 10) ?? null,
      })),
    })),
  });
}

const createSchema = z.object({
  financeProjectId: z.string(),
  donorId: z.string().optional(),
  donorName: z.string().min(1),
  totalAmount: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
  restriction: z.enum(["UNRESTRICTED", "RESTRICTED", "DESIGNATED"]).optional(),
  reportingCadence: z.string().optional(),
  pipelineEntryId: z.string().optional(),
  tranches: z
    .array(
      z.object({
        amount: z.number().positive(),
        dueDate: z.string(),
        reportDueDate: z.string().optional(),
        milestoneBudgetId: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const agreement = await createGrantAgreement(prisma, {
      ...parsed.data,
      startDate: parseDateOnly(parsed.data.startDate),
      endDate: parseDateOnly(parsed.data.endDate),
      tranches: parsed.data.tranches.map((t) => ({
        amount: t.amount,
        dueDate: parseDateOnly(t.dueDate),
        reportDueDate: t.reportDueDate ? parseDateOnly(t.reportDueDate) : undefined,
        milestoneBudgetId: t.milestoneBudgetId,
      })),
      userId: user.id,
    });
    return NextResponse.json(
      { agreement: { id: agreement.id, agreementNumber: agreement.agreementNumber } },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

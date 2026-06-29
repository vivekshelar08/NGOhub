import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { expenseSchema } from "@/lib/validators";
import { parseDateOnly } from "@/lib/hr-utils";
import {
  checkBudgetEncumbrance,
  resolveFinanceProjectId,
  resolveFundId,
} from "@/lib/finance-meta";

const syncSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("expense_submit"),
    payload: expenseSchema,
  }),
  z.object({
    action: z.literal("beneficiary_feedback"),
    payload: z.object({
      beneficiaryId: z.string(),
      type: z.enum(["FEEDBACK", "COMPLAINT", "SATISFACTION"]),
      note: z.string(),
      rating: z.number().optional(),
    }),
  }),
  z.object({
    action: z.literal("volunteer_hours"),
    payload: z.object({
      volunteerId: z.string(),
      hours: z.number(),
      activityDate: z.string(),
      projectId: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const items = z.array(syncSchema).safeParse(body.items ?? [body]);
  if (!items.success) return NextResponse.json({ error: items.error.flatten() }, { status: 400 });

  const results: Array<{ action: string; ok: boolean; error?: string }> = [];

  for (const item of items.data) {
    try {
      if (item.action === "expense_submit") {
        const p = item.payload;
        const financeProjectId = await resolveFinanceProjectId(prisma, {
          financeProjectId: p.financeProjectId,
          projectId: p.projectId,
        });
        const fundId = await resolveFundId(prisma, { fundId: p.fundId, fundType: p.fundType });
        if (financeProjectId) {
          const check = await checkBudgetEncumbrance(prisma, {
            financeProjectId,
            budgetHead: p.budgetHead,
            amount: p.amount,
          });
          if (!check.ok) throw new Error(check.message);
        }
        await prisma.expense.create({
          data: {
            submittedById: user.id,
            category: p.category,
            paymentType: p.paymentType,
            amount: p.amount,
            expenseDate: parseDateOnly(p.expenseDate),
            description: p.description,
            conveyanceFrom: p.conveyanceFrom,
            conveyanceTo: p.conveyanceTo,
            conveyanceKm: p.conveyanceKm,
            projectId: p.projectId,
            budgetHead: p.budgetHead,
            fundType: p.fundType,
            fundId,
            financeProjectId,
            attachments: { create: p.attachments },
          },
        });
      } else if (item.action === "beneficiary_feedback") {
        await prisma.beneficiaryFeedback.create({
          data: { ...item.payload, createdById: user.id },
        });
      } else if (item.action === "volunteer_hours") {
        await prisma.volunteerHour.create({
          data: {
            ...item.payload,
            activityDate: parseDateOnly(item.payload.activityDate),
            recordedById: user.id,
          },
        });
      }
      results.push({ action: item.action, ok: true });
    } catch (e) {
      results.push({ action: item.action, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }

  return NextResponse.json({ results });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import {
  syncLegacyProjectToFinance,
  syncMilestoneFromFieldActivity,
} from "@/lib/ngo-integrations";
import { seedLogframeFromMilestones } from "@/lib/me-logframe";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "auto_finance_project") {
    const parsed = z
      .object({
        legacyProjectId: z.string(),
        title: z.string(),
        totalBudget: z.number(),
        donorId: z.string().optional(),
        donorName: z.string().optional(),
        fundingType: z.string().optional(),
        milestones: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              budgetPercent: z.number(),
              kpis: z.array(z.record(z.string(), z.number().optional())).optional(),
            })
          )
          .optional(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const result = await syncLegacyProjectToFinance(prisma, {
      ...parsed.data,
      milestones: parsed.data.milestones?.map((m) => ({
        id: m.id,
        name: m.name,
        budgetPercent: m.budgetPercent,
        kpis: (m.kpis ?? []).map((k) => ({
          activityCount: k.activityCount,
          beneficiaryCount: k.beneficiaryCount,
          achievedActivityCount: k.achievedActivityCount,
          achievedBeneficiaryCount: k.achievedBeneficiaryCount,
        })),
      })),
    });

    if (parsed.data.milestones?.length) {
      await seedLogframeFromMilestones(
        prisma,
        result.project.id,
        parsed.data.title,
        parsed.data.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          kpis: (m.kpis ?? []).map((k) => ({
            name: String(k.name ?? "Indicator"),
            beneficiaryCount: k.beneficiaryCount,
            activityCount: k.activityCount,
            achievedBeneficiaries: k.achievedBeneficiaryCount,
            achievedActivityCount: k.achievedActivityCount,
          })),
        }))
      );
    }

    return NextResponse.json({
      financeProjectId: result.project.id,
      code: result.project.code,
      created: result.created,
    });
  }

  if (action === "sync_milestone_from_activity") {
    const parsed = z
      .object({
        legacyProjectId: z.string(),
        legacyMilestoneId: z.string(),
        activities: z.number().optional(),
        beneficiaries: z.number().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const mb = await syncMilestoneFromFieldActivity(prisma, parsed.data.legacyProjectId, parsed.data.legacyMilestoneId, {
      activities: parsed.data.activities,
      beneficiaries: parsed.data.beneficiaries,
    });
    return NextResponse.json({ milestoneBudget: mb });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

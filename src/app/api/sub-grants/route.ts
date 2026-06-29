import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { parseDateOnly } from "@/lib/hr-utils";
import {
  approvePartnerUc,
  createSubGrantAgreement,
  listSubGrants,
  rollupPartnerUcsForProject,
  submitPartnerUc,
} from "@/lib/sub-grants";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_projects")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const financeProjectId = searchParams.get("financeProjectId") ?? undefined;

  if (searchParams.get("rollup") === "1" && financeProjectId) {
    const rollup = await rollupPartnerUcsForProject(prisma, financeProjectId);
    return NextResponse.json(rollup);
  }

  const grants = await listSubGrants(prisma, financeProjectId);
  return NextResponse.json({
    grants: grants.map((g) => ({
      ...g,
      amount: Number(g.amount),
      adminPercent: Number(g.adminPercent),
      startDate: g.startDate.toISOString().slice(0, 10),
      endDate: g.endDate.toISOString().slice(0, 10),
      partnerUcs: g.partnerUcs.map((u) => ({
        ...u,
        amount: Number(u.amount),
        periodStart: u.periodStart.toISOString().slice(0, 10),
        periodEnd: u.periodEnd.toISOString().slice(0, 10),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_projects")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action as string;

  if (action === "create_agreement") {
    const parsed = z
      .object({
        partnerId: z.string(),
        financeProjectId: z.string(),
        amount: z.number().positive(),
        adminPercent: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
        notes: z.string().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const sg = await createSubGrantAgreement(prisma, {
      ...parsed.data,
      startDate: parseDateOnly(parsed.data.startDate),
      endDate: parseDateOnly(parsed.data.endDate),
      userId: user.id,
    });
    return NextResponse.json({ subGrant: { id: sg.id, agreementNumber: sg.agreementNumber } }, { status: 201 });
  }

  if (action === "submit_uc") {
    const parsed = z
      .object({
        subGrantId: z.string(),
        periodStart: z.string(),
        periodEnd: z.string(),
        amount: z.number().positive(),
        notes: z.string().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const uc = await submitPartnerUc(
      prisma,
      parsed.data.subGrantId,
      parseDateOnly(parsed.data.periodStart),
      parseDateOnly(parsed.data.periodEnd),
      parsed.data.amount,
      parsed.data.notes
    );
    return NextResponse.json({ uc: { id: uc.id } }, { status: 201 });
  }

  if (action === "approve_uc") {
    const parsed = z.object({ ucId: z.string() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const uc = await approvePartnerUc(prisma, parsed.data.ucId, user.id);
    return NextResponse.json({ uc: { id: uc.id, status: uc.status } });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

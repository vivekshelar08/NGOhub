import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { parseDateOnly } from "@/lib/hr-utils";
import {
  approvePurchaseRequest,
  createAssetFromPo,
  createPurchaseRequest,
  createVendorBillFromPo,
  issuePurchaseOrder,
  listPurchaseRequests,
} from "@/lib/procure-to-pay";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await listPurchaseRequests(prisma);
  return NextResponse.json({
    requests: requests.map((r) => ({
      ...r,
      amount: Number(r.amount),
      approvedAt: r.approvedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const action = body.action as string;

  if (action === "create_request") {
    if (!hasFeature(user.role, "finance.submit") && !hasFeature(user.role, "finance.vendors")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = z
      .object({
        financeProjectId: z.string().optional(),
        milestoneBudgetId: z.string().optional(),
        vendorId: z.string().optional(),
        budgetHead: z.string().optional(),
        description: z.string().min(1),
        amount: z.number().positive(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const req = await createPurchaseRequest(prisma, { ...parsed.data, userId: user.id });
    return NextResponse.json({ request: { id: req.id, requestNumber: req.requestNumber } }, { status: 201 });
  }

  if (action === "approve") {
    if (!hasFeature(user.role, "finance.approve")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = z.object({ requestId: z.string(), notes: z.string().optional() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    try {
      const req = await approvePurchaseRequest(prisma, parsed.data.requestId, parsed.data.notes);
      return NextResponse.json({ request: { id: req.id, status: req.status } });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
    }
  }

  if (action === "issue_po") {
    if (!hasFeature(user.role, "finance.vendors")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = z.object({ requestId: z.string(), vendorId: z.string() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const po = await issuePurchaseOrder(prisma, parsed.data.requestId, parsed.data.vendorId, user.id);
    return NextResponse.json({ po: { id: po.id, poNumber: po.poNumber } }, { status: 201 });
  }

  if (action === "create_bill") {
    if (!hasFeature(user.role, "finance.vendors")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = z
      .object({
        poId: z.string(),
        billNumber: z.string(),
        billDate: z.string(),
        gstAmount: z.number().optional(),
        tdsAmount: z.number().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const bill = await createVendorBillFromPo(
      prisma,
      parsed.data.poId,
      parsed.data.billNumber,
      parseDateOnly(parsed.data.billDate),
      user.id,
      parsed.data.gstAmount,
      parsed.data.tdsAmount
    );
    return NextResponse.json({ bill: { id: bill.id } }, { status: 201 });
  }

  if (action === "create_asset") {
    if (!hasFeature(user.role, "finance.vendors")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const parsed = z
      .object({
        poId: z.string(),
        name: z.string(),
        category: z.string(),
        value: z.number(),
        projectId: z.string().optional(),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const asset = await createAssetFromPo(
      prisma,
      parsed.data.poId,
      parsed.data.name,
      parsed.data.category,
      parsed.data.value,
      parsed.data.projectId
    );
    return NextResponse.json({ asset: { id: asset.id } }, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

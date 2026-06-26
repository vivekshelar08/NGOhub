import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { reverseJournalEntry } from "@/lib/accounting";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.accounting")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  try {
    const entry = await reverseJournalEntry(prisma, id, user.id, body.reason);
    return NextResponse.json({ entry: { id: entry.id, voucherNumber: entry.voucherNumber } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reversal failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

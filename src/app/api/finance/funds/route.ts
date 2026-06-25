import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ensureAccountingSetup } from "@/lib/accounting";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureAccountingSetup(prisma);

  const funds = await prisma.fund.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ funds });
}

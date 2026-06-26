import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { parseDateOnly } from "@/lib/hr-utils";

const createSchema = z.object({
  name: z.string().min(1),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  tdsSection: z.string().optional(),
  tdsRate: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vendors = await prisma.vendor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { bills: true } },
    },
  });

  return NextResponse.json({
    vendors: vendors.map((v) => ({
      ...v,
      tdsRate: v.tdsRate ? Number(v.tdsRate) : null,
      billCount: v._count.bills,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vendor" }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({ data: parsed.data });
  return NextResponse.json({ vendor }, { status: 201 });
}

const patchSchema = createSchema.partial().extend({
  id: z.string(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.vendors")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vendor" }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const vendor = await prisma.vendor.update({
    where: { id },
    data,
  });

  return NextResponse.json({ vendor });
}

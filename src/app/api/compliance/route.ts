import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { deriveComplianceStatus, defaultComplianceSeed } from "@/lib/compliance-utils";
import { z } from "zod";

const createSchema = z.object({
  type: z.enum([
    "FCRA_FC4",
    "SECTION_80G",
    "SECTION_12A",
    "NGO_DARPAN",
    "CSR_UC",
    "STATUTORY_AUDIT",
    "ITR",
    "OTHER",
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string(),
  reminderDays: z.number().int().min(1).max(365).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.complianceItem.findMany({ orderBy: { dueDate: "asc" } });
  const serialized = items.map((item) => ({
    ...item,
    dueDate: item.dueDate.toISOString().slice(0, 10),
    filedAt: item.filedAt?.toISOString() ?? null,
    status: deriveComplianceStatus(item.dueDate, item.filedAt),
  }));

  return NextResponse.json({ items: serialized });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "seed") {
    const count = await prisma.complianceItem.count();
    if (count > 0) {
      return NextResponse.json({ message: "Already seeded", seeded: 0 });
    }
    const year = new Date().getFullYear();
    const seeds = defaultComplianceSeed(year);
    await prisma.complianceItem.createMany({
      data: seeds.map((s) => ({
        type: s.type,
        title: s.title,
        description: s.description,
        dueDate: new Date(s.dueDate),
        reminderDays: s.reminderDays,
        status: deriveComplianceStatus(new Date(s.dueDate), null),
      })),
    });
    return NextResponse.json({ seeded: seeds.length });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dueDate = new Date(parsed.data.dueDate);
  const item = await prisma.complianceItem.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate,
      reminderDays: parsed.data.reminderDays ?? 30,
      status: deriveComplianceStatus(dueDate, null),
    },
  });

  return NextResponse.json({
    item: {
      ...item,
      dueDate: item.dueDate.toISOString().slice(0, 10),
      filedAt: item.filedAt?.toISOString() ?? null,
    },
  });
}

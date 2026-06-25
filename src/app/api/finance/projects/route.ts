import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";

const projectSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  fundingType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalBudget: z.number().positive().optional(),
  legacyProjectId: z.string().optional(),
  budgetLines: z
    .array(
      z.object({
        budgetHead: z.string(),
        amount: z.number().positive(),
        fundId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.budget")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.financeProject.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      budgetLines: { include: { fund: { select: { code: true, name: true } } } },
    },
  });

  return NextResponse.json({
    projects: projects.map((p) => ({
      ...p,
      totalBudget: p.totalBudget ? Number(p.totalBudget) : null,
      startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
      budgetLines: p.budgetLines.map((b) => ({
        ...b,
        amount: Number(b.amount),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.budget")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = projectSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  const existing = await prisma.financeProject.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json({ error: "Project code exists" }, { status: 409 });
  }

  const project = await prisma.financeProject.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description,
      fundingType: parsed.data.fundingType,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      totalBudget: parsed.data.totalBudget,
      legacyProjectId: parsed.data.legacyProjectId,
      budgetLines: parsed.data.budgetLines
        ? { create: parsed.data.budgetLines }
        : undefined,
    },
    include: { budgetLines: { include: { fund: true } } },
  });

  return NextResponse.json({ project }, { status: 201 });
}

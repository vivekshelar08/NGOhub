import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "donors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await prisma.donorPipelineEntry.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      nextFollowUp: e.nextFollowUp?.toISOString().slice(0, 10) ?? null,
      proposalSentAt: e.proposalSentAt?.toISOString() ?? null,
      grantedAt: e.grantedAt?.toISOString() ?? null,
      reportDueDate: e.reportDueDate?.toISOString().slice(0, 10) ?? null,
      amountPledged: e.amountPledged ? Number(e.amountPledged) : null,
    })),
  });
}

const createSchema = z.object({
  donorId: z.string().min(1),
  donorName: z.string().min(1),
  stage: z
    .enum(["PROSPECT", "PROPOSAL_SENT", "NEGOTIATION", "GRANTED", "REPORTING", "CLOSED"])
    .default("PROSPECT"),
  nextFollowUp: z.string().optional(),
  amountPledged: z.number().optional(),
  projectId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "donors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await prisma.donorPipelineEntry.create({
    data: {
      donorId: parsed.data.donorId,
      donorName: parsed.data.donorName,
      stage: parsed.data.stage,
      nextFollowUp: parsed.data.nextFollowUp ? new Date(parsed.data.nextFollowUp) : undefined,
      amountPledged: parsed.data.amountPledged,
      projectId: parsed.data.projectId,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ entry });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "donors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const entry = await prisma.donorPipelineEntry.update({
    where: { id },
    data: {
      stage: body.stage,
      nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : undefined,
      reportDueDate: body.reportDueDate ? new Date(body.reportDueDate) : undefined,
      amountPledged: body.amountPledged,
      notes: body.notes,
      proposalSentAt: body.stage === "PROPOSAL_SENT" ? new Date() : undefined,
      grantedAt: body.stage === "GRANTED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ entry });
}

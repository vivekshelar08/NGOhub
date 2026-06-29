import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { createGrantAgreementFromPipelineEntry } from "@/lib/grant-agreements";
import { DonorPipelineStage } from "@/generated/prisma/enums";
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

async function maybeCreateGrantAgreement(
  entry: {
    id: string;
    donorId: string;
    donorName: string;
    projectId: string | null;
    amountPledged: { toString(): string } | null;
    reportDueDate: Date | null;
    stage: DonorPipelineStage;
  },
  userId: string
) {
  if (entry.stage !== DonorPipelineStage.GRANTED) return null;
  return createGrantAgreementFromPipelineEntry(prisma, entry, userId);
}

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
      proposalSentAt: parsed.data.stage === "PROPOSAL_SENT" ? new Date() : undefined,
      grantedAt: parsed.data.stage === "GRANTED" ? new Date() : undefined,
    },
  });

  let grantAgreement: { agreementNumber: string; created: boolean } | null = null;
  if (parsed.data.stage === "GRANTED") {
    try {
      const result = await maybeCreateGrantAgreement(entry, user.id);
      if (result) {
        grantAgreement = {
          agreementNumber: result.agreement.agreementNumber,
          created: result.created,
        };
      }
    } catch (e) {
      return NextResponse.json(
        {
          entry,
          grantError: e instanceof Error ? e.message : "Grant agreement failed",
        },
        { status: 201 }
      );
    }
  }

  return NextResponse.json({ entry, grantAgreement });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "donors.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const previous = await prisma.donorPipelineEntry.findUnique({ where: { id } });
  if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStage = body.stage as DonorPipelineStage | undefined;
  const entry = await prisma.donorPipelineEntry.update({
    where: { id },
    data: {
      stage: newStage,
      nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : undefined,
      reportDueDate: body.reportDueDate ? new Date(body.reportDueDate) : undefined,
      amountPledged: body.amountPledged,
      projectId: body.projectId,
      notes: body.notes,
      proposalSentAt: newStage === "PROPOSAL_SENT" ? new Date() : undefined,
      grantedAt: newStage === "GRANTED" ? new Date() : undefined,
    },
  });

  let grantAgreement: { agreementNumber: string; created: boolean } | null = null;
  let grantError: string | undefined;

  if (newStage === "GRANTED" && previous.stage !== DonorPipelineStage.GRANTED) {
    try {
      const result = await maybeCreateGrantAgreement(entry, user.id);
      if (result) {
        grantAgreement = {
          agreementNumber: result.agreement.agreementNumber,
          created: result.created,
        };
      }
    } catch (e) {
      grantError = e instanceof Error ? e.message : "Grant agreement failed";
    }
  }

  return NextResponse.json({ entry, grantAgreement, grantError });
}

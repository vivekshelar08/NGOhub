import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import {
  getLogframeTree,
  getMeSnapshotFromLogframe,
  seedLogframeFromMilestones,
  updateIndicatorActual,
} from "@/lib/me-logframe";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const financeProjectId = new URL(request.url).searchParams.get("financeProjectId");
  if (!financeProjectId) return NextResponse.json({ error: "financeProjectId required" }, { status: 400 });

  if (new URL(request.url).searchParams.get("snapshot") === "1") {
    const rows = await getMeSnapshotFromLogframe(prisma, financeProjectId);
    return NextResponse.json({ rows });
  }

  const nodes = await getLogframeTree(prisma, financeProjectId);
  return NextResponse.json({
    nodes: nodes.map((n) => ({
      ...n,
      baseline: Number(n.baseline),
      target: Number(n.target),
      actual: Number(n.actual),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.budget")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (body.action === "seed") {
    const parsed = z
      .object({
        financeProjectId: z.string(),
        projectTitle: z.string(),
        milestones: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            kpis: z
              .array(
                z.object({
                  name: z.string(),
                  beneficiaryCount: z.number().optional(),
                  activityCount: z.number().optional(),
                  achievedBeneficiaries: z.number().optional(),
                  achievedActivityCount: z.number().optional(),
                })
              )
              .optional(),
          })
        ),
      })
      .safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const nodes = await seedLogframeFromMilestones(
      prisma,
      parsed.data.financeProjectId,
      parsed.data.projectTitle,
      parsed.data.milestones
    );
    return NextResponse.json({ count: nodes.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.budget")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = z.object({ nodeId: z.string(), actual: z.number() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const node = await updateIndicatorActual(prisma, parsed.data.nodeId, parsed.data.actual);
  return NextResponse.json({ node: { id: node.id, actual: Number(node.actual) } });
}

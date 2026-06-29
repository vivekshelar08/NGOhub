import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { LogframeLevel } from "@/generated/prisma/enums";
import type { MeIndicatorRow, MeRagStatus } from "@/lib/budgetTracking";

type Db = PrismaClient | Prisma.TransactionClient;

export interface LogframeSeedMilestone {
  id: string;
  name: string;
  kpis?: Array<{
    name: string;
    beneficiaryCount?: number;
    activityCount?: number;
    achievedBeneficiaries?: number;
    achievedActivityCount?: number;
  }>;
}

function ragStatus(target: number, actual: number): MeRagStatus {
  if (target <= 0) return "no_data";
  const pct = (actual / target) * 100;
  if (pct >= 75) return "on_track";
  if (pct >= 40) return "at_risk";
  return "behind";
}

/** Build logframe tree from legacy project milestones. */
export async function seedLogframeFromMilestones(
  prisma: Db,
  financeProjectId: string,
  projectTitle: string,
  milestones: LogframeSeedMilestone[]
) {
  const existing = await prisma.logframeNode.count({ where: { financeProjectId } });
  if (existing > 0) return prisma.logframeNode.findMany({ where: { financeProjectId } });

  const goal = await prisma.logframeNode.create({
    data: {
      financeProjectId,
      level: LogframeLevel.GOAL,
      name: projectTitle,
      sequence: 0,
    },
  });

  const nodes = [goal];
  for (let mi = 0; mi < milestones.length; mi++) {
    const m = milestones[mi];
    const outcome = await prisma.logframeNode.create({
      data: {
        financeProjectId,
        parentId: goal.id,
        level: LogframeLevel.OUTCOME,
        name: m.name,
        legacyMilestoneId: m.id,
        sequence: mi,
      },
    });
    nodes.push(outcome);

    for (let ki = 0; ki < (m.kpis ?? []).length; ki++) {
      const kpi = m.kpis![ki];
      const target = (kpi.beneficiaryCount ?? 0) + (kpi.activityCount ?? 0);
      const actual = (kpi.achievedBeneficiaries ?? 0) + (kpi.achievedActivityCount ?? 0);
      const indicator = await prisma.logframeNode.create({
        data: {
          financeProjectId,
          parentId: outcome.id,
          level: LogframeLevel.INDICATOR,
          name: kpi.name,
          unit: kpi.beneficiaryCount ? "beneficiaries" : "activities",
          target,
          actual,
          legacyMilestoneId: m.id,
          legacyKpiName: kpi.name,
          sequence: ki,
        },
      });
      nodes.push(indicator);
    }
  }
  return nodes;
}

export async function getLogframeTree(prisma: Db, financeProjectId: string) {
  return prisma.logframeNode.findMany({
    where: { financeProjectId },
    orderBy: [{ level: "asc" }, { sequence: "asc" }],
  });
}

export async function updateIndicatorActual(
  prisma: Db,
  nodeId: string,
  actual: number
) {
  return prisma.logframeNode.update({
    where: { id: nodeId },
    data: { actual },
  });
}

export function logframeToMeRows(
  nodes: Array<{
    level: string;
    name: string;
    target: { toString(): string };
    actual: { toString(): string };
    baseline: { toString(): string };
    parentId: string | null;
  }>,
  parentMap: Map<string, string>
): MeIndicatorRow[] {
  return nodes
    .filter((n) => n.level === "INDICATOR")
    .map((n) => {
      const target = Number(n.target);
      const actual = Number(n.actual);
      const baseline = Number(n.baseline);
      const range = target - baseline;
      const progress = range > 0 ? (actual / range) * 100 : target === 0 ? 0 : 100;
      return {
        milestoneName: parentMap.get(n.parentId ?? "") ?? "—",
        kpiName: n.name,
        baseline,
        target,
        actual,
        percentAchieved: Math.min(100, Math.max(0, progress)),
        status: ragStatus(target, actual),
      };
    });
}

export async function getMeSnapshotFromLogframe(prisma: Db, financeProjectId: string) {
  const nodes = await getLogframeTree(prisma, financeProjectId);
  const parentMap = new Map(nodes.map((n) => [n.id, n.name]));
  return logframeToMeRows(nodes, parentMap);
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { communityContributionRuleSchema } from "@/lib/validators";
import { serializeContributionRule } from "@/lib/community-contribution";

function contributionDbError(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /does not exist|CommunityContribution|column.*location|P2021|P2022|42P01/i.test(message)
  ) {
    return "Community contribution tables are not set up. On the server run: npx prisma db push";
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const location = searchParams.get("location")?.trim() ?? undefined;

  try {
    const rules = await prisma.communityContributionRule.findMany({
      where: {
        projectId,
        isActive: true,
        ...(location !== undefined ? { location } : {}),
      },
      include: { service: { select: { name: true } } },
      orderBy: [{ location: "asc" }, { service: { name: "asc" } }],
    });

    return NextResponse.json({
      rules: rules.map(serializeContributionRule),
    });
  } catch (error) {
    console.error("[GET /api/community-contributions/rules]", error);
    const dbHint = contributionDbError(error);
    return NextResponse.json(
      { error: dbHint ?? (error instanceof Error ? error.message : "Failed to load rules") },
      { status: dbHint ? 503 : 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = communityContributionRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const {
    projectId,
    serviceId,
    location,
    amountPerBeneficiary,
    recipientType,
    partnerId,
    partnerName,
  } = parsed.data;

  try {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service?.isActive) {
      return NextResponse.json({ error: "Service not found or inactive" }, { status: 400 });
    }

    const locationKey = location?.trim() ?? "";

    const rule = await prisma.communityContributionRule.upsert({
      where: {
        projectId_serviceId_location: { projectId, serviceId, location: locationKey },
      },
      create: {
        projectId,
        serviceId,
        location: locationKey,
        amountPerBeneficiary,
        recipientType,
        partnerId: partnerId ?? null,
        partnerName: partnerName ?? null,
        isActive: true,
      },
      update: {
        amountPerBeneficiary,
        recipientType,
        partnerId: partnerId ?? null,
        partnerName: partnerName ?? null,
        isActive: true,
      },
      include: { service: { select: { name: true } } },
    });

    return NextResponse.json({ rule: serializeContributionRule(rule) });
  } catch (error) {
    console.error("[POST /api/community-contributions/rules]", error);
    const dbHint = contributionDbError(error);
    return NextResponse.json(
      { error: dbHint ?? (error instanceof Error ? error.message : "Failed to save rule") },
      { status: dbHint ? 503 : 500 }
    );
  }
}

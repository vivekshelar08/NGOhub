import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { communityContributionRuleSchema } from "@/lib/validators";
import { serializeContributionRule } from "@/lib/community-contribution";

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
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "services.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
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
}

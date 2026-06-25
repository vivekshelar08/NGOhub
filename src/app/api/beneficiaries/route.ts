import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { beneficiarySchema } from "@/lib/validators";
import { generateBeneficiaryCode, decimalToNumber } from "@/lib/beneficiary-utils";
import { computeRecheckDueDate } from "@/lib/service-portal-utils";

function serializeBeneficiary(b: Record<string, unknown>) {
  const monthlyIncome = b.monthlyIncome;
  return {
    ...b,
    monthlyIncome: decimalToNumber(monthlyIncome),
    createdAt: (b.createdAt as Date).toISOString(),
    updatedAt: (b.updatedAt as Date).toISOString(),
    ...(Array.isArray(b.deliveries)
      ? {
          deliveries: (b.deliveries as Array<Record<string, unknown>>).map((d) => ({
            ...d,
            recheckDueDate: (d.recheckDueDate as Date).toISOString(),
            recheckedAt: d.recheckedAt ? (d.recheckedAt as Date).toISOString() : null,
            createdAt: (d.createdAt as Date).toISOString(),
            stepProgress: Array.isArray(d.stepProgress)
              ? (d.stepProgress as Array<Record<string, unknown>>).map((p) => ({
                  ...p,
                  completedAt: (p.completedAt as Date).toISOString(),
                }))
              : undefined,
          })),
        }
      : {}),
    followUps: Array.isArray(b.followUps)
      ? (b.followUps as Array<Record<string, unknown>>).map((f) => ({
          ...f,
          createdAt: (f.createdAt as Date).toISOString(),
        }))
      : undefined,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const projectId = searchParams.get("projectId")?.trim();
    const isExport = searchParams.get("export") === "1";
    const category = searchParams.get("category")?.trim();
    const urgentOnly = searchParams.get("urgentOnly") === "1";
    const caseStudyOnly = searchParams.get("caseStudyOnly") === "1";
    const removedOnly = searchParams.get("removedOnly") === "1";
    const includeRemoved = removedOnly || searchParams.get("includeRemoved") === "1";
    const from = searchParams.get("from")?.trim();
    const to = searchParams.get("to")?.trim();
    const includeAllDeliveries = isExport || searchParams.get("includeDeliveries") === "1";

    if (searchParams.get("countOnly") === "1" && projectId) {
      const count = await prisma.beneficiary.count({ where: { projectId } });
      return NextResponse.json({ count });
    }

    const filters: Array<Record<string, unknown>> = [];
    if (q) {
      filters.push({
        OR: [
          { beneficiaryCode: { contains: q, mode: "insensitive" as const } },
          { mobile: { contains: q } },
          { idDocumentNumber: { contains: q } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      });
    } else if (projectId) {
      filters.push({ projectId });
    }

    if (category) filters.push({ category });
    if (urgentOnly) filters.push({ isUrgentCase: true });
    if (caseStudyOnly) filters.push({ isCaseStudy: true });
    if (!includeRemoved) filters.push({ isRemoved: false });
    if (removedOnly) filters.push({ isRemoved: true });

    if (from || to) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (from) createdAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      filters.push({ createdAt });
    }

    const where =
      filters.length > 0 ? (filters.length === 1 ? filters[0] : { AND: filters }) : undefined;

    const beneficiaries = await prisma.beneficiary.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { deliveries: true } },
        deliveries: {
          ...(includeAllDeliveries ? {} : { take: 3 }),
          orderBy: { createdAt: "desc" },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                steps: { orderBy: { stepOrder: "asc" } },
              },
            },
            currentStep: true,
            enteredBy: { select: { id: true, name: true } },
            stepProgress: {
              select: { stepId: true, completedAt: true },
            },
          },
        },
        ...(includeAllDeliveries
          ? {
              followUps: {
                orderBy: { createdAt: "desc" as const },
                include: {
                  createdBy: { select: { id: true, name: true } },
                  delivery: { include: { service: { select: { name: true } } } },
                },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: isExport ? 5000 : 100,
    });

    return NextResponse.json({
      beneficiaries: beneficiaries.map(serializeBeneficiary),
    });
  } catch (error) {
    console.error("[GET /api/beneficiaries]", error);
    const message =
      error instanceof Error && error.message.includes("Unknown field")
        ? "Database client out of date. Stop the dev server, run npm run db:generate, then npm run dev again."
        : error instanceof Error
          ? error.message
          : "Failed to load beneficiaries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = beneficiarySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { serviceId, projectId, ...beneficiaryData } = parsed.data;

  if (serviceId) {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive) {
      return NextResponse.json({ error: "Service not found or inactive" }, { status: 400 });
    }
  }

  const beneficiaryCode = await generateBeneficiaryCode();
  const recheckDueDate = computeRecheckDueDate();

  const beneficiary = await prisma.beneficiary.create({
    data: {
      ...beneficiaryData,
      projectId,
      beneficiaryCode,
      createdById: user.id,
      deliveries: {
        create: {
          serviceId: serviceId ?? null,
          status: "DATA_ENTERED",
          recheckDueDate,
          enteredById: user.id,
        },
      },
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      deliveries: {
        include: {
          service: { select: { id: true, name: true } },
          enteredBy: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(
    { beneficiary: serializeBeneficiary(beneficiary) },
    { status: 201 }
  );
}

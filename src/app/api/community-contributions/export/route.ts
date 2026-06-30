import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/hr-utils";
import { decimalToNumber } from "@/lib/beneficiary-utils";
import {
  CONTRIBUTION_COLLECTION_LABELS,
  CONTRIBUTION_RECIPIENT_LABELS,
} from "@/lib/community-contribution-shared";
import { buildWorkbook, safeExportFilename } from "@/lib/excelUtils";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() || undefined;
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (from || to) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (from) createdAt.gte = parseDateOnly(from);
    if (to) {
      const end = parseDateOnly(to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const entries = await prisma.communityContributionEntry.findMany({
    where,
    include: {
      service: { select: { name: true } },
      beneficiary: { select: { name: true, beneficiaryCode: true } },
      enteredBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const rows = entries.map((e) => [
    e.createdAt.toISOString().slice(0, 10),
    e.beneficiary.beneficiaryCode,
    e.beneficiary.name,
    e.service.name,
    decimalToNumber(e.amount) ?? 0,
    CONTRIBUTION_COLLECTION_LABELS[e.collectionStatus],
    e.recipientType === "PARTNER"
      ? e.partnerName || CONTRIBUTION_RECIPIENT_LABELS.PARTNER
      : CONTRIBUTION_RECIPIENT_LABELS.NGO,
    e.enteredBy.name,
    e.collectedAt?.toISOString().slice(0, 10) ?? "",
  ]);

  const wb = buildWorkbook([
    {
      name: "Community contributions",
      headers: [
        "Date",
        "Beneficiary ID",
        "Name",
        "Service",
        "Amount (INR)",
        "Status",
        "Recipient",
        "Recorded by",
        "Collected on",
      ],
      rows,
    },
  ]);

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

  const filename = safeExportFilename(
    `community-contributions${projectId ? `-${projectId}` : ""}`
  );

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  });
}

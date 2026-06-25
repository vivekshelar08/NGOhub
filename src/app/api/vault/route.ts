import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

const uploadSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["MOU", "REGISTRATION", "FCRA", "CSR", "AUDIT", "BOARD", "OTHER"]).optional(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1),
  projectId: z.string().optional(),
  donorId: z.string().optional(),
  complianceItemId: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const donorId = searchParams.get("donorId");
  const complianceItemId = searchParams.get("complianceItemId");

  const where: Record<string, string> = {};
  if (projectId) where.projectId = projectId;
  if (donorId) where.donorId = donorId;
  if (complianceItemId) where.complianceItemId = complianceItemId;

  const docs = await prisma.vaultDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({
    documents: docs.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "projects.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = uploadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const doc = await prisma.vaultDocument.create({
    data: {
      ...parsed.data,
      category: parsed.data.category ?? "OTHER",
      uploadedById: user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ document: { ...doc, createdAt: doc.createdAt.toISOString() } });
}

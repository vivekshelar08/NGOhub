import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const assets = await prisma.assetItem.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    assets: assets.map((a) => ({
      ...a,
      value: a.value ? Number(a.value) : null,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  serialNumber: z.string().optional(),
  projectId: z.string().optional(),
  location: z.string().optional(),
  value: z.number().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const asset = await prisma.assetItem.create({ data: parsed.data });
  return NextResponse.json({ asset: { ...asset, value: asset.value ? Number(asset.value) : null } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const asset = await prisma.assetItem.update({
    where: { id },
    data: {
      name: body.name,
      category: body.category,
      status: body.status,
      location: body.location,
      notes: body.notes,
    },
  });

  return NextResponse.json({ asset });
}

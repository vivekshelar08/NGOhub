import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { z } from "zod";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const partners = await prisma.partnerOrganization.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ partners });
}

const createSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  panOrRegNo: z.string().optional(),
  dueDiligenceStatus: z.string().optional(),
  has80G: z.boolean().optional(),
  hasFcra: z.boolean().optional(),
  hasDarpan: z.boolean().optional(),
  notes: z.string().optional(),
  projectIds: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const partner = await prisma.partnerOrganization.create({
    data: {
      ...parsed.data,
      projectIds: parsed.data.projectIds ?? [],
    },
  });

  return NextResponse.json({ partner });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = body.id as string;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const partner = await prisma.partnerOrganization.update({
    where: { id },
    data: {
      name: body.name,
      contactPerson: body.contactPerson,
      email: body.email,
      phone: body.phone,
      panOrRegNo: body.panOrRegNo,
      dueDiligenceStatus: body.dueDiligenceStatus,
      has80G: body.has80G,
      hasFcra: body.hasFcra,
      hasDarpan: body.hasDarpan,
      notes: body.notes,
      projectIds: body.projectIds,
    },
  });

  return NextResponse.json({ partner });
}

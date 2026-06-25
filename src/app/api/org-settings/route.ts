import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { mergeOrgSettings } from "@/lib/orgSettings";
import { z } from "zod";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let row = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.orgSettings.create({ data: { id: "default" } });
  }

  return NextResponse.json({ settings: mergeOrgSettings(row) });
}

const patchSchema = z.object({
  orgName: z.string().min(1).optional(),
  orgAddress: z.string().nullable().optional(),
  orgPan: z.string().nullable().optional(),
  org80G: z.string().nullable().optional(),
  org12A: z.string().nullable().optional(),
  orgFcra: z.string().nullable().optional(),
  orgEmail: z.string().nullable().optional(),
  orgPhone: z.string().nullable().optional(),
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.number().int().nullable().optional(),
  smtpUser: z.string().nullable().optional(),
  smsProvider: z.string().nullable().optional(),
  smsApiKey: z.string().nullable().optional(),
  whatsappApiKey: z.string().nullable().optional(),
  razorpayKeyId: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.orgSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json({ settings: mergeOrgSettings(row) });
}

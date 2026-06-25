import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { deriveComplianceStatus } from "@/lib/compliance-utils";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["UPCOMING", "DUE", "FILED", "OVERDUE"]).optional(),
  filedAt: z.string().nullable().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.access")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.dueDate) data.dueDate = new Date(parsed.data.dueDate);
  if (parsed.data.filedAt !== undefined) {
    data.filedAt = parsed.data.filedAt ? new Date(parsed.data.filedAt) : null;
  }
  if (parsed.data.status) data.status = parsed.data.status;

  const item = await prisma.complianceItem.update({ where: { id }, data });
  const status = deriveComplianceStatus(item.dueDate, item.filedAt);
  if (status !== item.status) {
    await prisma.complianceItem.update({ where: { id }, data: { status } });
  }

  const updated = await prisma.complianceItem.findUnique({ where: { id } });
  return NextResponse.json({
    item: {
      ...updated,
      dueDate: updated!.dueDate.toISOString().slice(0, 10),
      filedAt: updated!.filedAt?.toISOString() ?? null,
      status: deriveComplianceStatus(updated!.dueDate, updated!.filedAt),
    },
  });
}

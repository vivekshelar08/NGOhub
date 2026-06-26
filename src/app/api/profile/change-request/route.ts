import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const changeRequestSchema = z.object({
  changes: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = changeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const allowedFields = new Set([
    "phone",
    "permanentAddress",
    "currentAddress",
    "emergencyContactName",
    "emergencyContactPhone",
    "panNumber",
    "bloodGroup",
  ]);

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data.changes)) {
    if (allowedFields.has(key) && value != null && String(value).trim() !== "") {
      filtered[key] = value;
    }
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "No valid changes to submit" }, { status: 400 });
  }

  const req = await prisma.profileChangeRequest.create({
    data: {
      userId: user.id,
      changes: filtered as Record<string, string>,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ request: req }, { status: 201 });
}

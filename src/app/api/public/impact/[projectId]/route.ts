import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicImpactData, listPublishedImpactPages } from "@/lib/public-impact";

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;
  const data = await getPublicImpactData(prisma, projectId);
  if (!data) return NextResponse.json({ error: "Not found or not published" }, { status: 404 });
  return NextResponse.json(data);
}

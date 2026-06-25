import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import {
  buildForm10BDData,
  buildFc4ScheduleData,
  buildForm112PrepPack,
} from "@/lib/compliance-exports";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "finance.compliance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const exportType = searchParams.get("type") ?? "10bd";
  const fy = searchParams.get("fy") ?? undefined;

  switch (exportType) {
    case "10bd":
      return NextResponse.json(await buildForm10BDData(prisma, fy));
    case "fc4":
      return NextResponse.json(await buildFc4ScheduleData(prisma, fy));
    case "112":
      return NextResponse.json(await buildForm112PrepPack(prisma, fy));
    default:
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }
}

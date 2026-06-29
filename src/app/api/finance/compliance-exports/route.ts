import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import {
  buildForm10BDData,
  buildFc4ScheduleData,
  buildForm112PrepPack,
  buildCsrAnnexureData,
  buildTds26QData,
  buildGstSummaryData,
  buildDarpanReminders,
  buildForm10BEData,
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
    case "10be":
      return NextResponse.json(await buildForm10BEData(prisma, fy));
    case "fc4":
      return NextResponse.json(await buildFc4ScheduleData(prisma, fy));
    case "112":
      return NextResponse.json(await buildForm112PrepPack(prisma, fy));
    case "csr":
      return NextResponse.json(await buildCsrAnnexureData(prisma, fy));
    case "26q": {
      const q = parseInt(searchParams.get("quarter") ?? "1", 10) as 1 | 2 | 3 | 4;
      return NextResponse.json(await buildTds26QData(prisma, q, fy));
    }
    case "gst": {
      const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
      const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
      return NextResponse.json(await buildGstSummaryData(prisma, month, year));
    }
    case "darpan":
      return NextResponse.json(await buildDarpanReminders(prisma));
    default:
      return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import {
  generateTodayActivityReport,
  TodayActivityReportRequest,
} from "@/lib/today-activity-report";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "activities.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as TodayActivityReportRequest;

    if (!body.userName?.trim()) {
      return NextResponse.json({ error: "userName is required" }, { status: 400 });
    }
    if (!body.tasks?.length) {
      return NextResponse.json({ error: "No activities to report" }, { status: 400 });
    }
    if (body.mode !== "single" && body.mode !== "daily") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const result = await generateTodayActivityReport({
      userName: body.userName.trim(),
      orgName: body.orgName,
      mode: body.mode,
      tasks: body.tasks,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/reports/today-activity]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Report generation failed" },
      { status: 500 }
    );
  }
}

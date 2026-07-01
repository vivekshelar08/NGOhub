import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { parseDateOnly } from "@/lib/hr-utils";
import { getUsersOnLeaveForDate } from "@/lib/leave-calendar-sync";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (
    !user ||
    !(
      hasFeature(user.role, "activities.assign") ||
      hasFeature(user.role, "activities.list") ||
      hasFeature(user.role, "hr.manage")
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dateParam = new URL(request.url).searchParams.get("date");
  if (!dateParam) {
    return NextResponse.json({ error: "date query param required" }, { status: 400 });
  }

  const date = parseDateOnly(dateParam);
  const onLeave = await getUsersOnLeaveForDate(prisma, date);

  return NextResponse.json({ date: dateParam, onLeave });
}

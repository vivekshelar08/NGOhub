import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { buildDailyContributionSummary } from "@/lib/community-contribution";
import { localDateKey } from "@/lib/hr-utils";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "beneficiaries.list")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId")?.trim() || undefined;
  const dateKey = searchParams.get("date")?.trim() || localDateKey();
  const mineOnly = searchParams.get("mine") === "1";

  try {
    const summary = await buildDailyContributionSummary({
      dateKey,
      projectId,
      enteredById: mineOnly ? user.id : undefined,
    });
    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

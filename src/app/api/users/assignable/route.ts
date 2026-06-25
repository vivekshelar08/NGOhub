import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";

export async function GET() {
  const currentUser = await getCurrentUser();

  const canAssignTeam = currentUser && hasFeature(currentUser.role, "projects.assign_team");
  const canAssignActivities =
    currentUser && hasFeature(currentUser.role, "activities.assign");

  if (!currentUser || (!canAssignTeam && !canAssignActivities)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["COORDINATOR", "STAFF", "MANAGER"] },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ users });
}

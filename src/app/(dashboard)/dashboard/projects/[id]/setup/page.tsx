import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { MilestoneSetupClient } from "@/components/projects/MilestoneSetupClient";

export default async function DashboardProjectSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user || !hasFeature(user.role, "projects.milestone_setup")) {
    redirect("/dashboard");
  }

  const assignableUsers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["COORDINATOR", "STAFF", "MANAGER"] },
    },
    select: { id: true, email: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <MilestoneSetupClient
      projectId={id}
      basePath="/dashboard/projects"
      variant="light"
      assignableUsers={assignableUsers}
    />
  );
}

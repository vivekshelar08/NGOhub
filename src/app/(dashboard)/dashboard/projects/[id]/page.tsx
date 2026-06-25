import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ProjectPageClient } from "@/components/projects/ProjectPageClient";

export default async function DashboardProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user || !hasFeature(user.role, "projects.view")) {
    redirect("/dashboard");
  }

  return (
    <ProjectPageClient
      projectId={id}
      mode="auto"
      basePath="/dashboard/projects"
      variant="light"
      canReview={hasFeature(user.role, "projects.review")}
    />
  );
}

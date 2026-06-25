import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ProjectPageClient } from "@/components/projects/ProjectPageClient";

export default async function EditDashboardProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user || !hasFeature(user.role, "projects.edit")) {
    redirect("/dashboard/projects");
  }

  return (
    <ProjectPageClient
      projectId={id}
      mode="edit"
      basePath="/dashboard/projects"
      variant="light"
    />
  );
}

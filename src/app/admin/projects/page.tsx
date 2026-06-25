import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ProjectsListView } from "@/components/projects/ProjectsListView";

export default async function AdminProjectsPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "projects.list")) {
    redirect("/dashboard");
  }

  return (
    <ProjectsListView
      basePath="/admin/projects"
      variant="dark"
      canCreate={hasFeature(user.role, "projects.create")}
      canEdit={hasFeature(user.role, "projects.edit")}
      canDelete={hasFeature(user.role, "projects.delete")}
      canReview={hasFeature(user.role, "projects.review")}
    />
  );
}

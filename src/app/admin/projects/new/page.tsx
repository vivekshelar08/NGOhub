import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { NewProjectWizardClient } from "@/components/projects/NewProjectWizardClient";

export default async function AdminNewProjectPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "projects.create")) {
    redirect("/dashboard");
  }

  return <NewProjectWizardClient basePath="/admin/projects" variant="dark" />;
}

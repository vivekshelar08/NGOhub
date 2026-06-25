import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { SurveysView } from "@/components/surveys/SurveysView";

export default async function SurveysPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "surveys.list")) {
    redirect("/dashboard");
  }

  const canCreate = hasFeature(user.role, "surveys.create");
  const canFill = hasFeature(user.role, "surveys.fill");
  const canViewResults = hasFeature(user.role, "surveys.results");
  const canExport = hasFeature(user.role, "surveys.export");

  return (
    <SurveysView
      userName={user.name}
      canCreate={canCreate}
      canFill={canFill}
      canViewResults={canViewResults}
      canExport={canExport}
    />
  );
}

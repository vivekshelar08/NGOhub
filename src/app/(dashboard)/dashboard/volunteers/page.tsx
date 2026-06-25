import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { VolunteersView } from "@/components/volunteers/VolunteersView";

export default async function VolunteersPage() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "activities.list")) {
    redirect("/dashboard");
  }
  return (
    <div className="page-shell">
      <VolunteersView />
    </div>
  );
}

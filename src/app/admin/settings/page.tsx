import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { OrgSettingsView } from "@/components/admin/OrgSettingsView";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user.role, "admin.settings")) redirect("/admin");
  return <OrgSettingsView />;
}

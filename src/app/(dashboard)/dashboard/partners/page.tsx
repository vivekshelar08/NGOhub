import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PartnersView } from "@/components/partners/PartnersView";

export default async function PartnersPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_projects")) redirect("/dashboard");
  return <PartnersView />;
}

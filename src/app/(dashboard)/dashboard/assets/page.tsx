import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { AssetsView } from "@/components/assets/AssetsView";

export default async function AssetsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "manage_accounting")) redirect("/dashboard");
  return <AssetsView />;
}

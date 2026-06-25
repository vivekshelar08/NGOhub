import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PendingInboxView } from "@/components/pending/PendingInboxView";

export default async function PendingInboxPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "view_pending_inbox")) {
    redirect("/dashboard");
  }
  return <PendingInboxView />;
}

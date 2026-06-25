import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { BoardPortalView } from "@/components/board/BoardPortalView";

export default async function BoardPortalPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "view_board_portal")) redirect("/dashboard");
  return <BoardPortalView />;
}

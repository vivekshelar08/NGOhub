import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { HrManagementView } from "@/components/hr/HrManagementView";

export default async function HrPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "hr.attendance")) {
    redirect("/dashboard");
  }

  if (user.role === "HR") {
    redirect("/dashboard");
  }

  return (
    <div className="p-6 md:p-8">
      <HrManagementView
        userId={user.id}
        userName={user.name}
        canManageHr={false}
      />
    </div>
  );
}

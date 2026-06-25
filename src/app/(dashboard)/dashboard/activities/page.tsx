import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { ActivitiesView } from "@/components/activities/ActivitiesView";
import { Role } from "@/generated/prisma/enums";

function ActivitiesLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Loading activities…
    </div>
  );
}

export default async function ActivitiesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/dashboard");
  }

  const canViewTasks = hasFeature(user.role, "activities.list");
  const canViewCalendar = hasFeature(user.role, "calendar.view");

  if (!canViewTasks && !canViewCalendar) {
    redirect("/dashboard");
  }

  const canAssign = canViewTasks && hasFeature(user.role, "activities.assign");
  const canViewAll = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <Suspense fallback={<ActivitiesLoading />}>
      <ActivitiesView
        userId={user.id}
        userRole={user.role as Role}
        canViewTasks={canViewTasks}
        canAssign={!!canAssign}
        canViewAll={canViewAll}
        canViewCalendar={canViewCalendar}
        canRequest={hasFeature(user.role, "calendar.request")}
        canApprove={hasFeature(user.role, "calendar.approve")}
      />
    </Suspense>
  );
}

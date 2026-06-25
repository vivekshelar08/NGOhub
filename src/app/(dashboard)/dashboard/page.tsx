import { getCurrentUser } from "@/lib/auth";

import { hasFeature } from "@/lib/role-features";

import { HrManagementView } from "@/components/hr/HrManagementView";

import { DashboardHomeClient } from "@/components/dashboard/DashboardHomeClient";

import { Role } from "@/generated/prisma/enums";



export default async function DashboardPage() {

  const user = await getCurrentUser();

  if (!user) return null;



  if (user.role === "HR") {

    return (

      <div className="page-shell">

        <HrManagementView

          userId={user.id}

          userName={user.name}

          canManageHr

        />

      </div>

    );

  }



  const showPunch = user.role !== "ADMIN" && hasFeature(user.role as Role, "hr.punch");



  return (

    <DashboardHomeClient

      userId={user.id}

      userName={user.name}

      userRole={user.role as Role}

      canExport={hasFeature(user.role, "dashboard.export")}

      showPunch={showPunch}

    />

  );

}


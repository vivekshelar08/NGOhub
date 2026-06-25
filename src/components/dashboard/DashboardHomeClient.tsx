"use client";

import { useState } from "react";
import { Role } from "@/generated/prisma/enums";
import { MyWorkDashboard } from "@/components/dashboard/MyWorkDashboard";
import { AchievementsDashboard } from "@/components/achievements/AchievementsDashboard";

interface DashboardHomeClientProps {
  userId: string;
  userName: string;
  userRole: Role;
  canExport: boolean;
  showPunch: boolean;
}

export function DashboardHomeClient({
  userId,
  userName,
  userRole,
  canExport,
  showPunch,
}: DashboardHomeClientProps) {
  const [view, setView] = useState<"work" | "impact">("work");

  if (view === "impact") {
    return (
      <AchievementsDashboard
        userName={userName}
        canExport={canExport}
        showPunch={showPunch}
        onBackToWork={() => setView("work")}
      />
    );
  }

  return (
    <MyWorkDashboard
      userId={userId}
      userName={userName}
      userRole={userRole}
      showPunch={showPunch}
      onViewImpact={() => setView("impact")}
    />
  );
}

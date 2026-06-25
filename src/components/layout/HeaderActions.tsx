"use client";

import { TeamMessagePanel } from "@/components/layout/TeamMessagePanel";
import { NotificationBell } from "@/components/layout/NotificationBell";

interface HeaderActionsProps {
  variant?: "light" | "dark";
}

/** Notification bell + team message cloud — upper-right header actions. */
export function HeaderActions({ variant = "light" }: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <TeamMessagePanel variant={variant} />
      <NotificationBell variant={variant} />
    </div>
  );
}

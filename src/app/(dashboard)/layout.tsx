import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SessionRefresh } from "@/components/layout/SessionRefresh";
import { ClientDataSync } from "@/components/layout/ClientDataSync";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardShell user={user}>
      <SessionRefresh />
      <ClientDataSync />
      {children}
    </DashboardShell>
  );
}

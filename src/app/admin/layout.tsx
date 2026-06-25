import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { SessionRefresh } from "@/components/layout/SessionRefresh";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasFeature(user.role, "admin.access")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-brand-ink">
      <SessionRefresh />
      <AdminSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader user={user} />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-100 via-white to-brand-mist">
          {children}
        </main>
      </div>
    </div>
  );
}

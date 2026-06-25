import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { prisma } from "@/lib/prisma";
import { AdminUsersView } from "@/components/admin/AdminUsersView";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "admin.users")) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      department: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminUsersView
      initialUsers={users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      }))}
    />
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { DonorsManagementView } from "@/components/projects/DonorsManagementView";

export default async function AdminDonorsPage() {
  const user = await getCurrentUser();

  if (!user || !hasFeature(user.role, "donors.list")) {
    redirect("/dashboard");
  }

  return <DonorsManagementView variant="dark" />;
}

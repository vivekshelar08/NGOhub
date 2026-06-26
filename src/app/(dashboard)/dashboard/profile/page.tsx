import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileView } from "@/components/profile/ProfileView";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ProfileView />;
}

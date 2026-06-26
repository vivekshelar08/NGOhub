import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Home auth check failed:", error);
  }
  redirect(user ? "/dashboard" : "/login");
}

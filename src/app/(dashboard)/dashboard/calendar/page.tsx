import { redirect } from "next/navigation";

/** Legacy route — calendar is merged into Activities. */
export default function CalendarPage() {
  redirect("/dashboard/activities?view=calendar");
}

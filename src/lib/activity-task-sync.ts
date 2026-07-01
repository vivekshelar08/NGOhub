import {
  type ActivityTask,
  ACTIVITIES_STORAGE_KEY,
  loadActivityTasks,
  saveActivityTasks,
} from "@/lib/activities";
import { loadProjects } from "@/lib/projects";
import { Role } from "@/generated/prisma/enums";

function coordinatorProjectIds(userId: string): string[] {
  return loadProjects()
    .filter((p) => p.setup?.staff?.coordinatorId === userId)
    .map((p) => p.id);
}

function mergeTasks(local: ActivityTask[], remote: ActivityTask[]): ActivityTask[] {
  const byId = new Map<string, ActivityTask>();
  for (const task of local) byId.set(task.id, task);
  for (const task of remote) {
    const existing = byId.get(task.id);
    if (!existing || task.updatedAt >= existing.updatedAt) {
      byId.set(task.id, task);
    }
  }
  return [...byId.values()];
}

function buildSyncQuery(userId: string, userRole: Role, canViewAll: boolean): string {
  const params = new URLSearchParams();
  if (canViewAll) params.set("scope", "all");
  if (userRole === "COORDINATOR") {
    const ids = coordinatorProjectIds(userId);
    if (ids.length > 0) params.set("projectIds", ids.join(","));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Pull tasks from server, merge with localStorage, and push any newer local-only tasks. */
export async function syncActivityTasksFromServer(
  userId: string,
  userRole: Role,
  canViewAll: boolean
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const res = await fetch(`/api/activity-tasks${buildSyncQuery(userId, userRole, canViewAll)}`);
    if (!res.ok) return;

    const data = (await res.json()) as { tasks?: ActivityTask[] };
    const remote = data.tasks ?? [];
    const local = loadActivityTasks();
    const merged = mergeTasks(local, remote);
    saveActivityTasks(merged);

    const remoteById = new Map(remote.map((t) => [t.id, t]));
    for (const task of local) {
      const serverCopy = remoteById.get(task.id);
      if (!serverCopy || task.updatedAt > serverCopy.updatedAt) {
        void pushActivityTaskToServer(task);
      }
    }
  } catch {
    /* offline — keep local tasks */
  }
}

export async function pushActivityTaskToServer(task: ActivityTask): Promise<void> {
  if (typeof window === "undefined") return;
  await fetch("/api/activity-tasks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  });
}

export async function deleteActivityTaskOnServer(taskId: string): Promise<void> {
  if (typeof window === "undefined") return;
  await fetch(`/api/activity-tasks?id=${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}

/** One-time migration hint: upload all local tasks if server is empty. */
export async function ensureLocalTasksUploaded(): Promise<void> {
  if (typeof window === "undefined") return;
  const flag = `${ACTIVITIES_STORAGE_KEY}-server-synced`;
  if (localStorage.getItem(flag)) return;

  const local = loadActivityTasks();
  for (const task of local) {
    await pushActivityTaskToServer(task).catch(() => {});
  }
  localStorage.setItem(flag, "1");
}

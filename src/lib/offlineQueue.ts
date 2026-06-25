const QUEUE_KEY = "ngo-hub-offline-queue";

export type OfflineQueueAction =
  | "expense_submit"
  | "beneficiary_feedback"
  | "activity_complete"
  | "volunteer_hours"
  | "beneficiary_register";

export interface OfflineQueueItem {
  id: string;
  action: OfflineQueueAction;
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
  lastError?: string;
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineQueueItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("offline-queue-updated"));
}

export function enqueueOffline(action: OfflineQueueAction, payload: Record<string, unknown>) {
  const item: OfflineQueueItem = {
    id: crypto.randomUUID(),
    action,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  const queue = loadOfflineQueue();
  queue.push(item);
  saveOfflineQueue(queue);
  return item;
}

export function removeFromQueue(id: string) {
  saveOfflineQueue(loadOfflineQueue().filter((q) => q.id !== id));
}

export async function flushOfflineQueue(
  handlers: Partial<Record<OfflineQueueAction, (payload: Record<string, unknown>) => Promise<void>>>
): Promise<{ synced: number; failed: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  const queue = loadOfflineQueue();

  for (const item of queue) {
    const handler = handlers[item.action];
    if (!handler) continue;
    try {
      await handler(item.payload);
      removeFromQueue(item.id);
      synced++;
    } catch (err) {
      failed++;
      const updated = loadOfflineQueue().map((q) =>
        q.id === item.id
          ? { ...q, retries: q.retries + 1, lastError: err instanceof Error ? err.message : "Failed" }
          : q
      );
      saveOfflineQueue(updated);
    }
  }

  return { synced, failed };
}

export function pendingOfflineCount(): number {
  return loadOfflineQueue().length;
}

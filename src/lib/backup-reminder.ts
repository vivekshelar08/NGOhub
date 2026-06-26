const BACKUP_DATE_KEY = "ngo-hub-last-backup-date";

export function getLastBackupDate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BACKUP_DATE_KEY);
}

export function recordBackupDate(date = new Date()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BACKUP_DATE_KEY, date.toISOString().slice(0, 10));
}

export function isBackupOverdue(): boolean {
  const last = getLastBackupDate();
  if (!last) return true;
  const lastDate = new Date(`${last}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 1;
}

export function daysSinceLastBackup(): number | null {
  const last = getLastBackupDate();
  if (!last) return null;
  const lastDate = new Date(`${last}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

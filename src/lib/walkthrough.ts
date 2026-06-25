const STORAGE_KEY = "ngo-hub-walkthrough";

export type WalkthroughModule =
  | "dashboard"
  | "beneficiaries"
  | "projects"
  | "finance"
  | "compliance"
  | "pending";

export interface WalkthroughStep {
  target: string;
  title: string;
  body: string;
}

export const WALKTHROUGH_STEPS: Record<WalkthroughModule, WalkthroughStep[]> = {
  dashboard: [
    { target: "nav", title: "Your menu", body: "Use the sidebar to jump to your daily work areas." },
    { target: "work", title: "My Work", body: "See what needs your attention today — follow-ups, approvals, and tasks." },
  ],
  beneficiaries: [
    { target: "quick-add", title: "Quick register", body: "Add someone with just name and phone. Expand for more details anytime." },
    { target: "tabs", title: "People & follow-ups", body: "Switch between your registered people and pending follow-ups." },
  ],
  projects: [
    { target: "wizard", title: "3-step proposal", body: "Basics, plan, and review — optional sections stay collapsed until you need them." },
  ],
  finance: [
    { target: "submit", title: "Submit expenses", body: "Attach bills and tag to a project budget head when applicable." },
  ],
  compliance: [
    { target: "calendar", title: "Deadlines", body: "Track FCRA, 80G, audit dates. Load defaults on first visit." },
  ],
  pending: [
    { target: "inbox", title: "One place for approvals", body: "All pending items across modules appear here." },
  ],
};

export function isWalkthroughDismissed(module: WalkthroughModule): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const dismissed = raw ? (JSON.parse(raw) as string[]) : [];
    return dismissed.includes(module);
  } catch {
    return false;
  }
}

export function dismissWalkthrough(module: WalkthroughModule) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const dismissed = raw ? (JSON.parse(raw) as string[]) : [];
    if (!dismissed.includes(module)) {
      dismissed.push(module);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
    }
  } catch {
    /* ignore */
  }
}

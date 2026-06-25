export interface SdgGoal {
  id: number;
  title: string;
  shortTitle: string;
}

/** UN Sustainable Development Goals (1–17). */
export const SDG_GOALS: SdgGoal[] = [
  { id: 1, title: "No Poverty", shortTitle: "No Poverty" },
  { id: 2, title: "Zero Hunger", shortTitle: "Zero Hunger" },
  { id: 3, title: "Good Health and Well-being", shortTitle: "Good Health" },
  { id: 4, title: "Quality Education", shortTitle: "Quality Education" },
  { id: 5, title: "Gender Equality", shortTitle: "Gender Equality" },
  { id: 6, title: "Clean Water and Sanitation", shortTitle: "Clean Water" },
  { id: 7, title: "Affordable and Clean Energy", shortTitle: "Clean Energy" },
  { id: 8, title: "Decent Work and Economic Growth", shortTitle: "Decent Work" },
  { id: 9, title: "Industry, Innovation and Infrastructure", shortTitle: "Innovation" },
  { id: 10, title: "Reduced Inequalities", shortTitle: "Reduced Inequalities" },
  { id: 11, title: "Sustainable Cities and Communities", shortTitle: "Sustainable Cities" },
  { id: 12, title: "Responsible Consumption and Production", shortTitle: "Responsible Consumption" },
  { id: 13, title: "Climate Action", shortTitle: "Climate Action" },
  { id: 14, title: "Life Below Water", shortTitle: "Life Below Water" },
  { id: 15, title: "Life on Land", shortTitle: "Life on Land" },
  { id: 16, title: "Peace, Justice and Strong Institutions", shortTitle: "Peace & Justice" },
  { id: 17, title: "Partnerships for the Goals", shortTitle: "Partnerships" },
];

export function getSdgGoal(id: number): SdgGoal | undefined {
  return SDG_GOALS.find((goal) => goal.id === id);
}

export function formatSdgLabel(id: number): string {
  const goal = getSdgGoal(id);
  return goal ? `SDG ${id}: ${goal.title}` : `SDG ${id}`;
}

export function formatSdgList(ids: number[]): string {
  if (ids.length === 0) return "—";
  return [...ids]
    .sort((a, b) => a - b)
    .map((id) => formatSdgLabel(id))
    .join("; ");
}

export function normalizeSdgGoals(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((v) => Number(v)).filter((id) => id >= 1 && id <= 17))).sort(
    (a, b) => a - b
  );
}

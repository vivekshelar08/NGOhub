import { ServiceDeliveryStatus } from "@/generated/prisma/enums";

export interface ServiceStepInfo {
  id: string;
  stepOrder: number;
  name: string;
  description?: string | null;
}

export interface StepProgressInfo {
  stepId: string;
  completedAt: string;
  completedBy?: { name: string };
}

export interface DeliveryForDisplay {
  status: ServiceDeliveryStatus;
  objectionActive: boolean;
  objectionNote?: string | null;
  currentStepId?: string | null;
  currentStep?: ServiceStepInfo | null;
  service?: { steps?: ServiceStepInfo[] } | null;
  stepProgress?: StepProgressInfo[];
}

export type StepVisualState = "completed" | "current" | "pending" | "objection";

export interface StepVisual {
  step: ServiceStepInfo;
  state: StepVisualState;
}

export function getOrderedSteps(delivery: DeliveryForDisplay): ServiceStepInfo[] {
  return [...(delivery.service?.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
}

export function getCompletedStepIds(delivery: DeliveryForDisplay): Set<string> {
  return new Set((delivery.stepProgress ?? []).map((p) => p.stepId));
}

export function getStepVisuals(delivery: DeliveryForDisplay): StepVisual[] {
  const steps = getOrderedSteps(delivery);
  const completed = getCompletedStepIds(delivery);

  return steps.map((step) => {
    let state: StepVisualState = "pending";
    if (completed.has(step.id)) {
      state = "completed";
    } else if (delivery.objectionActive && delivery.currentStepId === step.id) {
      state = "objection";
    } else if (delivery.currentStepId === step.id && delivery.status === "IN_PROGRESS") {
      state = "current";
    }
    return { step, state };
  });
}

export function getDeliveryDisplayLabel(delivery: DeliveryForDisplay): string {
  if (delivery.objectionActive) {
    const note = delivery.objectionNote?.trim();
    return note ? `Objection — ${note}` : "Objection raised";
  }
  if (delivery.status === "DATA_ENTERED") return "Data Entered";
  if (delivery.status === "COMPLETED") return "Completed";
  if (delivery.status === "REJECTED") return "Rejected";
  if (delivery.status === "IN_PROGRESS") {
    const current =
      delivery.currentStep ??
      getOrderedSteps(delivery).find((s) => s.id === delivery.currentStepId);
    if (current) return current.name;
    return "In Progress";
  }
  return delivery.status;
}

export function getDeliveryDisplayColor(delivery: DeliveryForDisplay): string {
  if (delivery.objectionActive) return "bg-orange-100 text-orange-900";
  if (delivery.status === "DATA_ENTERED") return "bg-blue-100 text-blue-800";
  if (delivery.status === "COMPLETED") return "bg-brand-mist text-brand-teal-dark";
  if (delivery.status === "REJECTED") return "bg-red-100 text-red-800";
  if (delivery.status === "IN_PROGRESS") return "bg-violet-100 text-violet-800";
  return "bg-slate-100 text-slate-700";
}

export const ID_DOCUMENT_LABELS: Record<string, string> = {
  AADHAAR: "Aadhaar",
  VOTER_ID: "Voter ID",
  RATION_CARD: "Ration Card",
  PAN: "PAN",
  OTHER: "Other ID",
};

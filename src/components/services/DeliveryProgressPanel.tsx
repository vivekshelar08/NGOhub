"use client";

import { useState } from "react";
import { AlertTriangle, Check, Circle, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  DeliveryForDisplay,
  getDeliveryDisplayColor,
  getDeliveryDisplayLabel,
  getStepVisuals,
} from "@/lib/delivery-progress";
import { StatusPill } from "./StatusPill";

export type DeliveryAction =
  | "approve"
  | "advance_step"
  | "objection"
  | "clear_objection"
  | "reject";

export type DeliveryPanelData = DeliveryForDisplay & {
  id: string;
  recheckDueDate?: string;
  enteredBy?: { name: string };
  recheckedBy?: { name: string } | null;
  objectionRaisedBy?: { name: string } | null;
};

interface DeliveryProgressPanelProps {
  delivery: DeliveryPanelData;
  loading?: boolean;
  compact?: boolean;
  showRecheckDue?: boolean;
  recheckOverdue?: boolean;
  recheckDueLabel?: string;
  /** When false, approval actions are hidden (view-only). */
  canManageDelivery?: boolean;
  onAction: (deliveryId: string, action: DeliveryAction, note?: string) => void;
}

export function DeliveryProgressPanel({
  delivery,
  loading,
  compact,
  showRecheckDue,
  recheckOverdue,
  recheckDueLabel,
  canManageDelivery = true,
  onAction,
}: DeliveryProgressPanelProps) {
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [objectionNote, setObjectionNote] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearNote, setClearNote] = useState("");

  const steps = getStepVisuals(delivery);
  const hasSteps = steps.length > 0;
  const currentStep = steps.find((s) => s.state === "current" || s.state === "objection");

  const canAct =
    delivery.status !== "COMPLETED" && delivery.status !== "REJECTED";

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={getDeliveryDisplayLabel(delivery)}
          className={getDeliveryDisplayColor(delivery)}
        />
        {showRecheckDue && delivery.status === "DATA_ENTERED" && recheckDueLabel && (
          <span
            className={cn(
              "text-xs",
              recheckOverdue ? "font-medium text-red-600" : "text-slate-500"
            )}
          >
            {recheckDueLabel}
          </span>
        )}
      </div>

      {hasSteps && delivery.status !== "DATA_ENTERED" && (
        <ol className="space-y-1.5">
          {steps.map(({ step, state }) => (
            <li key={step.id} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  state === "completed" && "bg-brand-mist text-brand-teal-dark",
                  state === "current" && "bg-violet-100 text-violet-700 ring-2 ring-violet-300",
                  state === "objection" && "bg-orange-100 text-orange-700 ring-2 ring-orange-300",
                  state === "pending" && "bg-slate-100 text-slate-400"
                )}
              >
                {state === "completed" ? (
                  <Check className="h-3 w-3" />
                ) : state === "objection" ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </span>
              <div>
                <p
                  className={cn(
                    "font-medium",
                    state === "completed" && "text-brand-teal-dark",
                    state === "current" && "text-violet-900",
                    state === "objection" && "text-orange-900",
                    state === "pending" && "text-slate-500"
                  )}
                >
                  {step.stepOrder}. {step.name}
                </p>
                {step.description && (
                  <p className="text-xs text-slate-500">{step.description}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {delivery.objectionActive && delivery.objectionNote && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <p className="flex items-center gap-1.5 font-medium">
            <Flag className="h-4 w-4" />
            Issue flagged
          </p>
          <p className="mt-1">{delivery.objectionNote}</p>
          {delivery.objectionRaisedBy && (
            <p className="mt-1 text-xs text-orange-700">
              Raised by {delivery.objectionRaisedBy.name}
            </p>
          )}
        </div>
      )}

      {delivery.enteredBy && (
        <p className="text-xs text-slate-500">Entered by {delivery.enteredBy.name}</p>
      )}
      {delivery.recheckedBy && (
        <p className="text-xs text-slate-500">Approved by {delivery.recheckedBy.name}</p>
      )}

      {canAct && canManageDelivery && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
          {delivery.status === "DATA_ENTERED" && !delivery.objectionActive && (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => onAction(delivery.id, "approve")}
              >
                {hasSteps ? "Approve & start steps" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => setObjectionOpen(true)}
              >
                <Flag className="mr-1 h-3.5 w-3.5" />
                Objection
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => onAction(delivery.id, "reject")}
              >
                Reject
              </Button>
            </>
          )}

          {delivery.status === "IN_PROGRESS" && !delivery.objectionActive && (
            <>
              <Button
                size="sm"
                disabled={loading}
                onClick={() => onAction(delivery.id, "advance_step")}
              >
                {currentStep
                  ? `Complete: ${currentStep.step.name}`
                  : "Complete step"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => setObjectionOpen(true)}
              >
                <Flag className="mr-1 h-3.5 w-3.5" />
                Objection
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => onAction(delivery.id, "reject")}
              >
                Reject
              </Button>
            </>
          )}

          {delivery.objectionActive && (
            <Button
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => setClearOpen(true)}
            >
              Clear objection
            </Button>
          )}
        </div>
      )}

      {objectionOpen && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-800">Describe the issue</p>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={objectionNote}
            onChange={(e) => setObjectionNote(e.target.value)}
            placeholder="Missing documents, incorrect data, beneficiary unavailable..."
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={loading || !objectionNote.trim()}
              onClick={() => {
                onAction(delivery.id, "objection", objectionNote.trim());
                setObjectionNote("");
                setObjectionOpen(false);
              }}
            >
              Raise objection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setObjectionOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {clearOpen && (
        <div className="rounded-lg border border-brand-teal/25 bg-brand-mist/50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-800">Resolution note (optional)</p>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            rows={2}
            value={clearNote}
            onChange={(e) => setClearNote(e.target.value)}
            placeholder="How was the issue resolved?"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={loading}
              onClick={() => {
                onAction(delivery.id, "clear_objection", clearNote.trim() || undefined);
                setClearNote("");
                setClearOpen(false);
              }}
            >
              Clear objection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileSpreadsheet,
  Play,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BeneficiaryCaptureSection } from "@/components/activities/BeneficiaryCaptureSection";
import { FileUploadTabs } from "@/components/activities/FileUploadTabs";
import { HelpTip } from "@/components/ui/HelpTip";
import { formatDateKey } from "@/lib/hr-utils";
import { cn } from "@/lib/utils";
import {
  ActivityTask,
  BeneficiaryEntry,
  BENEFICIARY_MODE_LABELS,
  cancelTask,
  completeTask,
  FileAttachment,
  getTaskBeneficiaryMode,
  normalizeMobile,
  PROJECT_SUB_TYPE_LABELS,
  rescheduleTask,
  startTask,
  validateActivityDate,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import { syncBeneficiariesToPortal } from "@/lib/beneficiary-sync";
import { getProjectById } from "@/lib/projects";
import { projectRequiresServiceOnEnrollment } from "@/lib/projectMeta";
import { exportActivityTaskExcel } from "@/lib/activityExport";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCategory } from "@/generated/prisma/enums";

function captureFieldEvidence(): Promise<{
  evidenceLatitude?: number;
  evidenceLongitude?: number;
  evidenceCapturedAt: string;
}> {
  return new Promise((resolve) => {
    const evidenceCapturedAt = new Date().toISOString();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ evidenceCapturedAt });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          evidenceLatitude: pos.coords.latitude,
          evidenceLongitude: pos.coords.longitude,
          evidenceCapturedAt,
        }),
      () => resolve({ evidenceCapturedAt }),
      { timeout: 8000, maximumAge: 60_000 }
    );
  });
}

interface TaskExecutionPanelProps {
  task: ActivityTask;
  onUpdate: () => void;
  onStartFocus?: () => void;
  onExitFocus?: () => void;
  focused?: boolean;
}

export function TaskExecutionPanel({
  task,
  onUpdate,
  onStartFocus,
  onExitFocus,
  focused,
}: TaskExecutionPanelProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [beneficiaryCount, setBeneficiaryCount] = useState(task.beneficiaryCount ?? 0);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryEntry[]>(
    task.beneficiaries ?? []
  );
  const [photos, setPhotos] = useState<FileAttachment[]>(task.photoAttachments ?? []);
  const [pdfs, setPdfs] = useState<FileAttachment[]>(task.pdfAttachments ?? []);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const beneficiaryMode = getTaskBeneficiaryMode(task);
  const project = getProjectById(task.projectId);
  const requireService = projectRequiresServiceOnEnrollment(project?.projectType);

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  function handleStart() {
    const dateCheck = validateActivityDate(task.scheduledDate ?? task.rescheduledTo);
    if (!dateCheck.ok) {
      setError(dateCheck.message ?? "Cannot start this activity today.");
      return;
    }
    setBusy(true);
    startTask(task.id);
    setBusy(false);
    onStartFocus?.();
    onUpdate();
  }

  function handleReschedule() {
    if (!rescheduleDate) {
      setError("Pick a new date for rescheduling.");
      return;
    }
    rescheduleTask(task.id, rescheduleDate, rescheduleReason);
    setShowReschedule(false);
    onUpdate();
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      setError("Provide a reason for cancellation.");
      return;
    }
    cancelTask(task.id, cancelReason.trim());
    setShowCancel(false);
    onExitFocus?.();
    onUpdate();
  }

  async function handleComplete() {
    setError("");

    const dateCheck = validateActivityDate(task.scheduledDate ?? task.rescheduledTo);
    if (!dateCheck.ok) {
      setError(dateCheck.message ?? "This activity can only be completed on its scheduled date.");
      return;
    }

    if (photos.length === 0) {
      setError("Upload at least one photo as activity evidence.");
      return;
    }

    if (beneficiaryMode === "list") {
      const valid = beneficiaries.filter(
        (b) => b.name.trim() && normalizeMobile(b.contact ?? "").length >= 10
      );
      if (valid.length === 0) {
        setError("Add at least one beneficiary with name and valid mobile number.");
        return;
      }
      if (requireService && valid.some((b) => !b.serviceId)) {
        setError("Select the service taken for each beneficiary before completing.");
        return;
      }

      setBusy(true);
      try {
        const evidence = await captureFieldEvidence();
        const { beneficiaries: synced } = await syncBeneficiariesToPortal(valid, {
          projectId: task.projectId,
          requireService,
        });
        const result = completeTask(task.id, {
          beneficiaries: synced,
          beneficiaryCount: synced.length,
          photoAttachments: photos,
          pdfAttachments: pdfs,
          notes,
          ...evidence,
        });
        if (!result) {
          setError("This activity can only be completed on its scheduled date.");
          return;
        }
        onExitFocus?.();
        onUpdate();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sync beneficiaries to Service Portal");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (beneficiaryMode === "count") {
      if (beneficiaryCount <= 0) {
        setError("Enter the number of beneficiaries covered.");
        return;
      }
      setBusy(true);
      const evidence = await captureFieldEvidence();
      const result = completeTask(task.id, {
        beneficiaryCount,
        photoAttachments: photos,
        pdfAttachments: pdfs,
        notes,
        ...evidence,
      });
      if (!result) {
        setError("This activity can only be completed on its scheduled date.");
        setBusy(false);
        return;
      }
    } else {
      setBusy(true);
      const evidence = await captureFieldEvidence();
      const result = completeTask(task.id, {
        beneficiaryCount: 0,
        photoAttachments: photos,
        pdfAttachments: pdfs,
        notes,
        ...evidence,
      });
      if (!result) {
        setError("This activity can only be completed on its scheduled date.");
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    onExitFocus?.();
    onUpdate();
  }

  const isTerminal = task.status === "completed" || task.status === "canceled";

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {focused && onExitFocus && (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onExitFocus}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to task list
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {task.activityCode && (
            <p className="mb-1 font-mono text-xs font-semibold text-brand-teal-dark">
              {task.activityCode}
            </p>
          )}
          <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
          <p className="text-sm text-slate-500">{task.projectTitle}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
              {WORK_TYPE_LABELS[task.workType]}
            </span>
            {task.projectSubType && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-600">
                {PROJECT_SUB_TYPE_LABELS[task.projectSubType]}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5",
                task.source === "milestone_kpi"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-violet-50 text-violet-700"
              )}
            >
              {task.source === "milestone_kpi" ? "Milestone KPI" : "Additional"}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5",
                beneficiaryMode === "list"
                  ? "bg-brand-mist text-brand-teal-dark"
                  : beneficiaryMode === "count"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              )}
            >
              {BENEFICIARY_MODE_LABELS[beneficiaryMode]}
            </span>
          </div>
        </div>
        {task.status === "completed" && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => exportActivityTaskExcel(task)}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
        )}
        {task.scheduledDate && (
          <p className="text-sm text-slate-500">
            Scheduled: {formatDateKey(task.scheduledDate.slice(0, 10))}
          </p>
        )}
      </div>

      {task.description && (
        <p className="text-sm text-slate-600">{task.description}</p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Assigned — show Start / Reschedule / Cancel */}
      {task.status === "assigned" && (
        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <Button onClick={handleStart} disabled={busy}>
            <Play className="mr-2 h-4 w-4" />
            Start activity
          </Button>
          <Button variant="secondary" onClick={() => setShowReschedule(true)}>
            <CalendarClock className="mr-2 h-4 w-4" />
            Reschedule
          </Button>
          <Button variant="danger" onClick={() => setShowCancel(true)}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}

      {/* Active — full execution form */}
      {task.status === "active" && (
        <div className="space-y-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={() => setShowReschedule(true)}>
              <CalendarClock className="mr-2 h-4 w-4" />
              Reschedule
            </Button>
            <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>

          {beneficiaryMode === "list" ? (
            <BeneficiaryCaptureSection
              beneficiaries={beneficiaries}
              onChange={setBeneficiaries}
              taskId={task.id}
              projectId={task.projectId}
              requireService={requireService}
            />
          ) : beneficiaryMode === "count" ? (
            <div className="max-w-xs">
              <label className={labelClass}>Beneficiaries covered (count)</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={beneficiaryCount}
                onChange={(e) => setBeneficiaryCount(parseInt(e.target.value) || 0)}
              />
            </div>
          ) : null}

          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              className={cn(inputClass, "min-h-[60px]")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <FileUploadTabs
            photos={photos}
            pdfs={pdfs}
            onPhotosChange={setPhotos}
            onPdfsChange={setPdfs}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleComplete} disabled={busy} className="w-full sm:w-auto">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete activity
            </Button>
            <HelpTip helpKey="field_evidence" />
          </div>
        </div>
      )}

      {/* Completed / Canceled — read-only summary */}
      {isTerminal && (
        <div className="space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
          {task.status === "canceled" && task.cancelReason && (
            <p className="text-red-600">Canceled: {task.cancelReason}</p>
          )}
          {task.status === "completed" && (
            <>
              <p>
                Beneficiaries covered:{" "}
                {beneficiaryMode === "none"
                  ? "N/A"
                  : beneficiaryMode === "list"
                    ? (task.beneficiaries?.length ?? 0)
                    : task.beneficiaryCount}
              </p>
              {task.beneficiaries && task.beneficiaries.length > 0 && (
                <ul className="space-y-2 text-slate-500">
                  {task.beneficiaries.map((b) => (
                    <li key={b.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{b.name}</span>
                      {b.contact && ` · ${b.contact}`}
                      {b.category && (
                        <span>
                          {" "}
                          · {BENEFICIARY_CATEGORY_LABELS[b.category as BeneficiaryCategory] ?? b.category}
                        </span>
                      )}
                      {b.annualIncome != null && ` · ₹${b.annualIncome.toLocaleString("en-IN")}/yr`}
                      {b.familyMembers != null && ` · ${b.familyMembers} family members`}
                    </li>
                  ))}
                </ul>
              )}
              {(task.photoAttachments?.length ?? 0) > 0 && (
                <p>{task.photoAttachments!.length} photo(s) attached</p>
              )}
              {task.evidenceCapturedAt && (
                <p className="text-emerald-700">
                  Verified visit · {new Date(task.evidenceCapturedAt).toLocaleString("en-IN")}
                  {task.evidenceLatitude != null && task.evidenceLongitude != null
                    ? ` · GPS ${task.evidenceLatitude.toFixed(4)}, ${task.evidenceLongitude.toFixed(4)}`
                    : ""}
                </p>
              )}
              {(task.pdfAttachments?.length ?? 0) > 0 && (
                <p>{task.pdfAttachments!.length} PDF(s) attached</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Reschedule modal */}
      {showReschedule && (
        <ModalOverlay onClose={() => setShowReschedule(false)}>
          <h4 className="font-semibold text-slate-900">Reschedule activity</h4>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>New date</label>
              <input
                type="date"
                className={inputClass}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Reason (optional)</label>
              <textarea
                className={inputClass}
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowReschedule(false)}>
                Back
              </Button>
              <Button onClick={handleReschedule}>Confirm reschedule</Button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Cancel modal */}
      {showCancel && (
        <ModalOverlay onClose={() => setShowCancel(false)}>
          <h4 className="font-semibold text-slate-900">Cancel activity</h4>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>Reason *</label>
              <textarea
                className={inputClass}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why is this activity being canceled?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCancel(false)}>
                Back
              </Button>
              <Button variant="danger" onClick={handleCancel}>
                Confirm cancel
              </Button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        {children}
      </div>
      <button
        type="button"
        className="sr-only"
        onClick={onClose}
        aria-label="Close"
      />
    </div>
  );
}

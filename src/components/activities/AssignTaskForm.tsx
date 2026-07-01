"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  ActivitySource,
  ActivityTask,
  ActivityWorkType,
  BeneficiaryMode,
  createTaskId,
  getAssignableProjects,
  ProjectActivitySubType,
  upsertActivityTask,
  WORK_TYPE_LABELS,
  PROJECT_SUB_TYPE_LABELS,
} from "@/lib/activities";
import { AssignTaskDraft } from "@/lib/activity-request-utils";
import { ProjectProposal } from "@/lib/projects";
import { LEAVE_TYPE_LABELS } from "@/lib/hr-types";
import { isEmergencyLeave } from "@/lib/leave-shared";
import { localDateKey } from "@/lib/hr-utils";

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AssignTaskFormProps {
  currentUserId: string;
  onAssigned: () => void;
  onCancel: () => void;
  /** Pre-fill from an approved activity request flow */
  draft?: AssignTaskDraft | null;
  /** Edit an existing assigned task */
  editTask?: ActivityTask | null;
}

export function AssignTaskForm({
  currentUserId,
  onAssigned,
  onCancel,
  draft,
  editTask,
}: AssignTaskFormProps) {
  const projects = useMemo(() => getAssignableProjects(), []);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const isEdit = Boolean(editTask);
  const fromRequest = Boolean(draft?.activityRequestId);

  const [projectId, setProjectId] = useState("");
  const [workType, setWorkType] = useState<ActivityWorkType>("office");
  const [projectSubType, setProjectSubType] = useState<ProjectActivitySubType>("group");
  const [source, setSource] = useState<ActivitySource>("additional");
  const [milestoneId, setMilestoneId] = useState("");
  const [kpiId, setKpiId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [beneficiaryMode, setBeneficiaryMode] = useState<BeneficiaryMode>("none");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [onLeaveForDate, setOnLeaveForDate] = useState<
    Array<{
      userId: string;
      userName: string;
      leaveType: string;
      isEmergency?: boolean;
      reason?: string | null;
      startDate: string;
      endDate: string;
    }>
  >([]);
  const [assignDespiteLeave, setAssignDespiteLeave] = useState(false);

  const selectedProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    fetch("/api/users/assignable")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setLoadingUsers(false);
      })
      .catch(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (editTask) {
      setProjectId(editTask.projectId);
      setWorkType(editTask.workType);
      setProjectSubType(editTask.projectSubType ?? "group");
      setSource(editTask.source);
      setMilestoneId(editTask.milestoneId ?? "");
      setKpiId(editTask.kpiId ?? "");
      setTitle(editTask.title);
      setDescription(editTask.description ?? "");
      setBeneficiaryMode(editTask.beneficiaryMode);
      setAssignedToUserId(editTask.assignedToUserId);
      setScheduledDate(editTask.scheduledDate?.slice(0, 10) ?? "");
      return;
    }

    if (draft) {
      setTitle(draft.title);
      setDescription(draft.description ?? "");
      setWorkType(draft.workType);
      setProjectId(draft.projectId ?? "");
      setScheduledDate(draft.scheduledDate ?? "");
      setAssignedToUserId(draft.assignedToUserId ?? "");
      setBeneficiaryMode(draft.workType === "office" ? "none" : "count");
    }
  }, [draft, editTask]);

  useEffect(() => {
    const date = scheduledDate || localDateKey();
    fetch(`/api/hr/leave/availability?date=${encodeURIComponent(date)}`)
      .then((r) => (r.ok ? r.json() : { onLeave: [] }))
      .then((data) => setOnLeaveForDate(data.onLeave ?? []))
      .catch(() => setOnLeaveForDate([]));
    setAssignDespiteLeave(false);
  }, [scheduledDate]);

  const selectedAssigneeLeave = onLeaveForDate.find((l) => l.userId === assignedToUserId);
  const assigneeOnEmergencyLeave =
    selectedAssigneeLeave && isEmergencyLeave(selectedAssigneeLeave);

  const milestones = selectedProject?.setup?.milestones ?? [];

  const kpis = useMemo(() => {
    if (!selectedProject || !milestoneId) return [];
    const milestone = milestones.find((m) => m.id === milestoneId);
    return milestone?.kpis ?? [];
  }, [selectedProject, milestoneId, milestones]);

  function handleProjectChange(id: string) {
    const changed = id !== projectId;
    setProjectId(id);
    if (changed) {
      setMilestoneId("");
      setKpiId("");
    }
    if (!isEdit && !fromRequest && changed) {
      setTitle("");
    }
  }

  function handleKpiChange(id: string) {
    setKpiId(id);
    const kpi = kpis.find((k) => k.id === id);
    if (kpi) {
      setTitle(kpi.name);
      setDescription(kpi.description);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!projectId || !title.trim() || !assignedToUserId) {
      setError("Project, title, and staff assignment are required.");
      return;
    }

    if (selectedAssigneeLeave && !assignDespiteLeave) {
      setError(
        `${selectedAssigneeLeave.userName} is on ${LEAVE_TYPE_LABELS[selectedAssigneeLeave.leaveType] ?? selectedAssigneeLeave.leaveType} (${selectedAssigneeLeave.startDate} – ${selectedAssigneeLeave.endDate}). Check "Assign anyway" to continue or pick another staff member.`
      );
      return;
    }

    if (source === "milestone_kpi" && (!milestoneId || !kpiId)) {
      setError("Select a milestone KPI for mandatory activities.");
      return;
    }

    const project = projects.find((p) => p.id === projectId)!;
    const milestone = milestones.find((m) => m.id === milestoneId);
    const kpi = kpis.find((k) => k.id === kpiId);

    setBusy(true);
    const now = new Date().toISOString();

    upsertActivityTask({
      id: editTask?.id ?? createTaskId(),
      activityCode: editTask?.activityCode,
      activityKind: editTask?.activityKind,
      projectCode: editTask?.projectCode,
      projectId,
      projectTitle: project.title,
      milestoneId: milestone?.id,
      milestoneName: milestone?.name,
      kpiId: kpi?.id,
      kpiName: kpi?.name,
      catalogItemId: kpi?.catalogItemId,
      title: title.trim(),
      description: description.trim() || undefined,
      workType,
      projectSubType: workType === "project" ? projectSubType : undefined,
      source,
      requiresBeneficiaryList: beneficiaryMode === "list",
      beneficiaryMode,
      assignedToUserId,
      assignedByUserId: editTask?.assignedByUserId ?? currentUserId,
      scheduledDate: scheduledDate || undefined,
      status: editTask?.status ?? "assigned",
      startedAt: editTask?.startedAt,
      completedAt: editTask?.completedAt,
      beneficiaries: editTask?.beneficiaries,
      beneficiaryCount: editTask?.beneficiaryCount,
      photoAttachments: editTask?.photoAttachments,
      pdfAttachments: editTask?.pdfAttachments,
      notes: editTask?.notes,
      activityRequestId: editTask?.activityRequestId ?? draft?.activityRequestId,
      createdAt: editTask?.createdAt ?? now,
      updatedAt: now,
    });

    if (!isEdit) {
      void fetch("/api/notifications/task-assigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigneeUserId: assignedToUserId,
          title: title.trim(),
          projectTitle: project.title,
          scheduledDate: scheduledDate || undefined,
        }),
      }).catch(() => {});
    }

    if (draft?.activityRequestId) {
      const approveRes = await fetch("/api/calendar/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.activityRequestId,
          action: "approve",
          reviewNotes: `Assigned to staff for field execution.`,
        }),
      });
      if (!approveRes.ok) {
        const data = await approveRes.json();
        setError(data.error ?? "Task saved but request approval failed.");
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    onAssigned();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal";
  const labelClass = "mb-1 block text-sm font-medium text-slate-700";

  const heading = isEdit
    ? "Edit activity task"
    : fromRequest
      ? "Approve activity request"
      : "Assign activity task";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>

      {fromRequest && draft && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Request from <strong>{draft.requesterName ?? "staff"}</strong> — route to any staff member,
          link to a milestone KPI if needed, then assign. The request is approved once you assign.
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Project</label>
          <select
            className={inputClass}
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            required
          >
            <option value="">Select project…</option>
            {projects.map((p: ProjectProposal) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Work type</label>
          <select
            className={inputClass}
            value={workType}
            onChange={(e) => {
              const next = e.target.value as ActivityWorkType;
              setWorkType(next);
              if (next === "office") {
                setBeneficiaryMode("none");
              } else if (beneficiaryMode === "none") {
                setBeneficiaryMode("count");
              }
            }}
          >
            {(Object.keys(WORK_TYPE_LABELS) as ActivityWorkType[]).map((type) => (
              <option key={type} value={type}>
                {WORK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {workType === "project" && (
        <div>
          <label className={labelClass}>Project activity type</label>
          <div className="flex gap-3">
            {(Object.keys(PROJECT_SUB_TYPE_LABELS) as ProjectActivitySubType[]).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                  projectSubType === type
                    ? "border-brand-teal bg-brand-mist text-brand-teal-dark"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <input
                  type="radio"
                  name="projectSubType"
                  value={type}
                  checked={projectSubType === type}
                  onChange={() => setProjectSubType(type)}
                  className="sr-only"
                />
                {PROJECT_SUB_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Activity source</label>
          <div className="flex gap-3">
            <label
              className={cn(
                "flex flex-1 cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
                source === "milestone_kpi"
                  ? "border-brand-teal bg-brand-mist"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <input
                type="radio"
                name="source"
                checked={source === "milestone_kpi"}
                onChange={() => setSource("milestone_kpi")}
                className="sr-only"
              />
              <span className="font-medium text-slate-900">Milestone (mandatory)</span>
              <span className="mt-0.5 text-xs text-slate-500">
                Links to KPI — counts toward milestone achievement
              </span>
            </label>
            <label
              className={cn(
                "flex flex-1 cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
                source === "additional"
                  ? "border-brand-teal bg-brand-mist"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <input
                type="radio"
                name="source"
                checked={source === "additional"}
                onChange={() => {
                  setSource("additional");
                  setMilestoneId("");
                  setKpiId("");
                }}
                className="sr-only"
              />
              <span className="font-medium text-slate-900">Additional activity</span>
              <span className="mt-0.5 text-xs text-slate-500">
                Extra coverage beyond milestone targets
              </span>
            </label>
          </div>
      </div>

      {source === "milestone_kpi" && selectedProject && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Milestone</label>
            <select
              className={inputClass}
              value={milestoneId}
              onChange={(e) => {
                setMilestoneId(e.target.value);
                setKpiId("");
              }}
            >
              <option value="">Select milestone…</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>KPI / Activity</label>
            <select
              className={inputClass}
              value={kpiId}
              onChange={(e) => handleKpiChange(e.target.value)}
              disabled={!milestoneId}
            >
              <option value="">Select KPI…</option>
              {kpis.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {source === "additional" && (
        <div>
          <label className={labelClass}>Activity title</label>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Extra awareness camp"
            required
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Description (optional)</label>
        <textarea
          className={cn(inputClass, "min-h-[80px] resize-y")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Instructions for staff…"
        />
      </div>

      <div>
        <label className={labelClass}>Beneficiary requirement</label>
        <div className="flex flex-wrap gap-3">
          {(
            workType === "office"
              ? (["list", "count", "none"] as BeneficiaryMode[])
              : (["list", "count"] as BeneficiaryMode[])
          ).map((mode) => (
            <label
              key={mode}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm",
                beneficiaryMode === mode
                  ? "border-brand-teal bg-brand-mist text-brand-teal-dark"
                  : "border-slate-200 text-slate-600"
              )}
            >
              <input
                type="radio"
                name="beneficiaryMode"
                checked={beneficiaryMode === mode}
                onChange={() => setBeneficiaryMode(mode)}
                className="sr-only"
              />
              {mode === "list" && "Yes — staff enters beneficiary details"}
              {mode === "count" && "No — count only"}
              {mode === "none" && "No beneficiary required"}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Assign to staff</label>
          <select
            className={inputClass}
            value={assignedToUserId}
            onChange={(e) => setAssignedToUserId(e.target.value)}
            required
            disabled={loadingUsers}
          >
            <option value="">
              {loadingUsers ? "Loading staff…" : "Select staff member…"}
            </option>
            {users.map((u) => {
              const leave = onLeaveForDate.find((l) => l.userId === u.id);
              const onLeaveLabel = leave
                ? ` — ON LEAVE${isEmergencyLeave(leave) ? " (EMERGENCY)" : ""}`
                : "";
              return (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}){onLeaveLabel}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <label className={labelClass}>Scheduled date</label>
          <input
            type="date"
            className={inputClass}
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
      </div>

      {selectedAssigneeLeave && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            assigneeOnEmergencyLeave
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          <strong>{selectedAssigneeLeave.userName}</strong> is on{" "}
          {LEAVE_TYPE_LABELS[selectedAssigneeLeave.leaveType] ?? selectedAssigneeLeave.leaveType}{" "}
          from {selectedAssigneeLeave.startDate} to {selectedAssigneeLeave.endDate}.
          {assigneeOnEmergencyLeave
            ? " Emergency leave — reassign to another staff member if possible."
            : " Consider another assignee or reschedule."}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={assignDespiteLeave}
              onChange={(e) => setAssignDespiteLeave(e.target.checked)}
            />
            Assign anyway (staff notified — manager should reassign if unavailable)
          </label>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          <Plus className="mr-2 h-4 w-4" />
          {isEdit ? "Save changes" : fromRequest ? "Approve & assign" : "Assign task"}
        </Button>
      </div>
    </form>
  );
}

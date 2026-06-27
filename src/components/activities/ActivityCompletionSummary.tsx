"use client";

import {
  ActivityTask,
  BENEFICIARY_MODE_LABELS,
  getTaskBeneficiaryCount,
  getTaskBeneficiaryMode,
  PROJECT_SUB_TYPE_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import {
  getGenderCounts,
  getServiceWiseCounts,
  getUniqueLocations,
} from "@/lib/activity-share";
import { formatDateKey } from "@/lib/hr-utils";
import { BENEFICIARY_CATEGORY_LABELS } from "@/lib/service-portal-utils";
import { BeneficiaryCategory } from "@/generated/prisma/enums";
import { MapPin, Clock, Target, Users } from "lucide-react";
import { TodaysActivityShareButton } from "@/components/activities/TodaysActivityShareButton";

interface ActivityCompletionSummaryProps {
  task: ActivityTask;
  userId: string;
  userName: string;
}

function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export function ActivityCompletionSummary({
  task,
  userId,
  userName,
}: ActivityCompletionSummaryProps) {
  const mode = getTaskBeneficiaryMode(task);
  const total = getTaskBeneficiaryCount(task);
  const beneficiaries = task.beneficiaries ?? [];
  const serviceCounts = getServiceWiseCounts(beneficiaries);
  const genderCounts = getGenderCounts(beneficiaries);
  const locations = getUniqueLocations(beneficiaries);
  const hasGender = genderCounts.male + genderCounts.female + genderCounts.other > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Activity completed
          </p>
          {task.completedAt && (
            <p className="mt-1 text-sm text-slate-500">
              {formatDateKey(task.completedAt.slice(0, 10))}
              {task.startedAt && (
                <>
                  {" "}
                  · {new Date(task.startedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  {" – "}
                  {new Date(task.completedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </>
              )}
            </p>
          )}
        </div>
        <TodaysActivityShareButton userId={userId} userName={userName} task={task} compact />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4 text-brand-teal" />}
          label="Total count"
          value={mode === "none" ? "N/A" : String(total)}
        />
        <StatCard
          icon={<Target className="h-4 w-4 text-brand-teal" />}
          label="Work type"
          value={`${WORK_TYPE_LABELS[task.workType]}${task.projectSubType ? ` · ${PROJECT_SUB_TYPE_LABELS[task.projectSubType]}` : ""}`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-brand-teal" />}
          label="Capture mode"
          value={BENEFICIARY_MODE_LABELS[mode]}
        />
        <StatCard
          icon={<MapPin className="h-4 w-4 text-brand-teal" />}
          label="Location"
          value={
            locations[0] ??
            (task.evidenceLatitude != null && task.evidenceLongitude != null
              ? "GPS verified"
              : "Not recorded")
          }
        />
      </div>

      {(task.milestoneName || task.kpiName) && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <span className="font-medium">Milestone / KPI: </span>
          {[task.milestoneName, task.kpiName].filter(Boolean).join(" → ")}
        </div>
      )}

      {serviceCounts.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Service-wise count</h4>
          <div className="flex flex-wrap gap-2">
            {serviceCounts.map((s) => (
              <span
                key={s.serviceName}
                className="rounded-full bg-brand-mist px-3 py-1 text-xs font-medium text-brand-teal-dark"
              >
                {s.serviceName}: {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasGender && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Gender count</h4>
          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            <span className="rounded-lg bg-slate-100 px-3 py-1">Boys: {genderCounts.male}</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1">Girls: {genderCounts.female}</span>
            {genderCounts.other > 0 && (
              <span className="rounded-lg bg-slate-100 px-3 py-1">Other: {genderCounts.other}</span>
            )}
          </div>
        </div>
      )}

      {locations.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Locations covered</h4>
          <ul className="space-y-1 text-sm text-slate-600">
            {locations.map((loc) => (
              <li key={loc} className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {loc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.evidenceCapturedAt && (
        <p className="text-sm text-emerald-700">
          Verified visit · {new Date(task.evidenceCapturedAt).toLocaleString("en-IN")}
          {task.evidenceLatitude != null && task.evidenceLongitude != null && (
            <>
              {" · "}
              <a
                href={mapsUrl(task.evidenceLatitude, task.evidenceLongitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-emerald-900"
              >
                Open GPS on map
              </a>
            </>
          )}
        </p>
      )}

      {task.notes?.trim() && (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium text-slate-800">Notes: </span>
          {task.notes.trim()}
        </div>
      )}

      {beneficiaries.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Beneficiaries ({beneficiaries.length})
          </h4>
          <ul className="space-y-2">
            {beneficiaries.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              >
                <p className="font-medium text-slate-800">{b.name}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  {b.contact && <span>{b.contact}</span>}
                  {b.serviceName && <span>Service: {b.serviceName}</span>}
                  {(b.location || b.address) && (
                    <span>📍 {b.location ?? b.address}</span>
                  )}
                  {b.category && (
                    <span>
                      {BENEFICIARY_CATEGORY_LABELS[b.category as BeneficiaryCategory] ?? b.category}
                    </span>
                  )}
                  {b.gender && <span>{b.gender}</span>}
                  {b.annualIncome != null && (
                    <span>₹{b.annualIncome.toLocaleString("en-IN")}/yr</span>
                  )}
                  {b.familyMembers != null && <span>{b.familyMembers} family</span>}
                  {b.isUrgentCase && <span className="text-amber-700">Urgent</span>}
                  {b.isCaseStudy && <span className="text-violet-700">Case study</span>}
                </div>
                {b.notes?.trim() && (
                  <p className="mt-1 text-xs text-slate-500">{b.notes.trim()}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(task.photoAttachments?.length ?? 0) > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            Photos ({task.photoAttachments!.length})
          </h4>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {task.photoAttachments!.slice(0, 8).map((photo) => (
              <a
                key={photo.id}
                href={photo.dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl}
                  alt={photo.name}
                  className="aspect-square w-full object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {(task.pdfAttachments?.length ?? 0) > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-800">Documents</h4>
          <ul className="space-y-1 text-sm text-slate-600">
            {task.pdfAttachments!.map((pdf) => (
              <li key={pdf.id}>
                <a
                  href={pdf.dataUrl}
                  download={pdf.name}
                  className="text-brand-teal hover:underline"
                >
                  {pdf.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

import {
  ActivityTask,
  BENEFICIARY_MODE_LABELS,
  getTaskBeneficiaryCount,
  getTaskBeneficiaryMode,
  PROJECT_SUB_TYPE_LABELS,
  TASK_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from "@/lib/activities";
import {
  BENEFICIARY_CATEGORY_LABELS,
  DELIVERY_STATUS_LABELS,
  formatCurrency,
} from "@/lib/service-portal-utils";
import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import { BeneficiaryCategory } from "@/generated/prisma/enums";
import { ID_DOCUMENT_LABELS } from "@/lib/delivery-progress";

interface PortalBeneficiary {
  id: string;
  beneficiaryCode: string;
  name: string;
  mobile: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  location: string | null;
  category: BeneficiaryCategory;
  monthlyIncome: number | null;
  familyMembers: number | null;
  pincode: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  isUrgentCase: boolean;
  isCaseStudy: boolean;
  notes: string | null;
  deliveries?: Array<{
    id: string;
    status: string;
    service?: { id: string; name: string } | null;
    enteredBy?: { name: string };
    recheckedAt: string | null;
    recheckDueDate: string;
    notes: string | null;
  }>;
}

const ROW_HEADERS = [
  "Activity Code",
  "Activity Title",
  "Activity Status",
  "Project",
  "Beneficiary Code",
  "Name",
  "Mobile",
  "Age",
  "Gender",
  "Category",
  "Location",
  "Address",
  "Pincode",
  "ID Type",
  "ID Number",
  "Monthly Income",
  "Family Members",
  "Service",
  "Service Status",
  "Recheck Due",
  "Approved On",
  "Entered By",
  "Urgent",
  "Case Study",
  "Notes",
];

async function fetchPortalBeneficiary(id: string): Promise<PortalBeneficiary | null> {
  const res = await fetch(`/api/beneficiaries/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.beneficiary as PortalBeneficiary;
}

function pickDelivery(portal: PortalBeneficiary | null, serviceId?: string) {
  if (!portal?.deliveries?.length) return undefined;
  if (serviceId) {
    const match = portal.deliveries.find((d) => d.service?.id === serviceId);
    if (match) return match;
  }
  return portal.deliveries[0];
}

function entryToRow(
  task: ActivityTask,
  entry: NonNullable<ActivityTask["beneficiaries"]>[number],
  portal: PortalBeneficiary | null
): (string | number | null)[] {
  const delivery = pickDelivery(portal, entry.serviceId);
  const status = delivery?.status ?? (entry.portalBeneficiaryId ? "UNKNOWN" : "NOT_SYNCED");

  return [
    task.activityCode ?? "",
    task.title,
    TASK_STATUS_LABELS[task.status],
    task.projectTitle,
    entry.beneficiaryCode ?? portal?.beneficiaryCode ?? "",
    entry.name,
    entry.contact ?? portal?.mobile ?? "",
    entry.age ?? portal?.age ?? "",
    entry.gender ?? portal?.gender ?? "",
    entry.category
      ? (BENEFICIARY_CATEGORY_LABELS[entry.category as BeneficiaryCategory] ?? entry.category)
      : portal?.category
        ? BENEFICIARY_CATEGORY_LABELS[portal.category]
        : "",
    entry.location ?? portal?.location ?? "",
    entry.address ?? portal?.address ?? "",
    portal?.pincode ?? "",
    portal?.idDocumentType
      ? (ID_DOCUMENT_LABELS[portal.idDocumentType] ?? portal.idDocumentType)
      : "",
    portal?.idDocumentNumber ?? "",
    portal?.monthlyIncome != null ? formatCurrency(portal.monthlyIncome) : "",
    entry.familyMembers ?? portal?.familyMembers ?? "",
    entry.serviceName ?? delivery?.service?.name ?? "",
    DELIVERY_STATUS_LABELS[status as keyof typeof DELIVERY_STATUS_LABELS] ?? status,
    delivery?.recheckDueDate
      ? new Date(delivery.recheckDueDate).toLocaleDateString("en-IN")
      : "",
    delivery?.recheckedAt
      ? new Date(delivery.recheckedAt).toLocaleDateString("en-IN")
      : "",
    delivery?.enteredBy?.name ?? "",
    entry.isUrgentCase || portal?.isUrgentCase ? "Yes" : "No",
    entry.isCaseStudy || portal?.isCaseStudy ? "Yes" : "No",
    entry.notes ?? portal?.notes ?? "",
  ];
}

/** Export all beneficiaries captured in field activities with portal service status. */
export async function exportActivityBeneficiariesExcel(
  tasks: ActivityTask[],
  filterLabel?: string
) {
  const withBeneficiaries = tasks.filter(
    (t) => getTaskBeneficiaryMode(t) === "list" && (t.beneficiaries?.length ?? 0) > 0
  );

  const portalCache = new Map<string, PortalBeneficiary | null>();
  const rows: (string | number | null)[][] = [];

  for (const task of withBeneficiaries) {
    for (const entry of task.beneficiaries ?? []) {
      let portal: PortalBeneficiary | null = null;
      if (entry.portalBeneficiaryId) {
        if (!portalCache.has(entry.portalBeneficiaryId)) {
          portalCache.set(
            entry.portalBeneficiaryId,
            await fetchPortalBeneficiary(entry.portalBeneficiaryId)
          );
        }
        portal = portalCache.get(entry.portalBeneficiaryId) ?? null;
      }
      rows.push(entryToRow(task, entry, portal));
    }
  }

  const summaryRows = tasks.map((task) => {
    const mode = getTaskBeneficiaryMode(task);
    return [
      task.activityCode ?? "",
      task.title,
      task.projectTitle,
      WORK_TYPE_LABELS[task.workType],
      task.projectSubType ? PROJECT_SUB_TYPE_LABELS[task.projectSubType] : "",
      TASK_STATUS_LABELS[task.status],
      BENEFICIARY_MODE_LABELS[mode],
      getTaskBeneficiaryCount(task),
      task.scheduledDate
        ? new Date(task.scheduledDate).toLocaleDateString("en-IN")
        : "",
      task.completedAt ? new Date(task.completedAt).toLocaleDateString("en-IN") : "",
    ];
  });

  exportSheetsToExcel(
    [
      {
        name: "Beneficiaries by Activity",
        headers: ROW_HEADERS,
        rows,
      },
      {
        name: "Activities Summary",
        headers: [
          "Activity Code",
          "Title",
          "Project",
          "Work Type",
          "Sub Type",
          "Status",
          "Beneficiary Mode",
          "Beneficiary Count",
          "Scheduled",
          "Completed",
        ],
        rows: summaryRows,
      },
    ],
    safeExportFilename("activity-beneficiaries", filterLabel)
  );

  return rows.length;
}

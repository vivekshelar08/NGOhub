import { BeneficiaryCategory } from "@/generated/prisma/enums";
import {
  BENEFICIARY_CATEGORY_LABELS,
  DELIVERY_STATUS_LABELS,
  formatCurrency,
} from "@/lib/service-portal-utils";
import { exportSheetsToExcel, safeExportFilename } from "@/lib/excelUtils";
import { ID_DOCUMENT_LABELS } from "@/lib/delivery-progress";

export interface BeneficiaryExportRow {
  id: string;
  beneficiaryCode: string;
  projectId: string | null;
  projectTitle?: string;
  name: string;
  age: number | null;
  gender: string | null;
  mobile: string | null;
  alternateMobile: string | null;
  idDocumentType: string | null;
  idDocumentNumber: string | null;
  pincode: string | null;
  address: string | null;
  category: BeneficiaryCategory;
  monthlyIncome: number | null;
  familyMembers: number | null;
  location: string | null;
  isUrgentCase: boolean;
  isCaseStudy: boolean;
  notes: string | null;
  createdAt: string;
  createdBy?: { name: string };
  deliveries?: Array<{
    id: string;
    status: string;
    recheckDueDate: string;
    recheckedAt: string | null;
    notes: string | null;
    service?: { name: string } | null;
    enteredBy?: { name: string };
  }>;
  followUps?: Array<{
    note: string;
    createdAt: string;
    createdBy: { name: string };
    delivery?: { service: { name: string } } | null;
  }>;
}

const BENEFICIARY_HEADERS = [
  "Code",
  "Name",
  "Project",
  "Mobile",
  "Alt. Mobile",
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
  "Urgent",
  "Case Study",
  "Services Count",
  "Latest Service",
  "Latest Status",
  "Notes",
  "Enrolled On",
  "Enrolled By",
];

function beneficiaryToRow(b: BeneficiaryExportRow): (string | number | null)[] {
  const latestDelivery = b.deliveries?.[0];
  return [
    b.beneficiaryCode,
    b.name,
    b.projectTitle ?? b.projectId ?? "",
    b.mobile,
    b.alternateMobile,
    b.age,
    b.gender,
    BENEFICIARY_CATEGORY_LABELS[b.category] ?? b.category,
    b.location,
    b.address,
    b.pincode,
    b.idDocumentType ? (ID_DOCUMENT_LABELS[b.idDocumentType] ?? b.idDocumentType) : "",
    b.idDocumentNumber,
    b.monthlyIncome != null ? formatCurrency(b.monthlyIncome) : "",
    b.familyMembers,
    b.isUrgentCase ? "Yes" : "No",
    b.isCaseStudy ? "Yes" : "No",
    b.deliveries?.length ?? 0,
    latestDelivery?.service?.name ?? "",
    latestDelivery?.status
      ? (DELIVERY_STATUS_LABELS[latestDelivery.status as keyof typeof DELIVERY_STATUS_LABELS] ??
        latestDelivery.status)
      : "",
    b.notes,
    new Date(b.createdAt).toLocaleDateString("en-IN"),
    b.createdBy?.name ?? "",
  ];
}

export function exportBeneficiariesExcel(
  beneficiaries: BeneficiaryExportRow[],
  options?: { projectTitle?: string; filterLabel?: string }
) {
  const suffix = options?.filterLabel ?? options?.projectTitle;
  exportSheetsToExcel(
    [
      {
        name: "Beneficiaries",
        headers: BENEFICIARY_HEADERS,
        rows: beneficiaries.map(beneficiaryToRow),
      },
    ],
    safeExportFilename("beneficiaries", suffix)
  );
}

export function exportSingleBeneficiaryExcel(b: BeneficiaryExportRow) {
  const sheets = [
    {
      name: "Profile",
      headers: BENEFICIARY_HEADERS,
      rows: [beneficiaryToRow(b)],
    },
  ];

  if (b.deliveries && b.deliveries.length > 0) {
    sheets.push({
      name: "Services",
      headers: [
        "Service",
        "Status",
        "Recheck Due",
        "Rechecked On",
        "Entered By",
        "Notes",
      ],
      rows: b.deliveries.map((d) => [
        d.service?.name ?? "",
        DELIVERY_STATUS_LABELS[d.status as keyof typeof DELIVERY_STATUS_LABELS] ?? d.status,
        new Date(d.recheckDueDate).toLocaleDateString("en-IN"),
        d.recheckedAt ? new Date(d.recheckedAt).toLocaleDateString("en-IN") : "",
        d.enteredBy?.name ?? "",
        d.notes,
      ]),
    });
  }

  if (b.followUps && b.followUps.length > 0) {
    sheets.push({
      name: "Follow-ups",
      headers: ["Date", "Note", "Service", "By"],
      rows: b.followUps.map((f) => [
        new Date(f.createdAt).toLocaleDateString("en-IN"),
        f.note,
        f.delivery?.service?.name ?? "",
        f.createdBy.name,
      ]),
    });
  }

  exportSheetsToExcel(sheets, safeExportFilename("beneficiary", b.beneficiaryCode));
}

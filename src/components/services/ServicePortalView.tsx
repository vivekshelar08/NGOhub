"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Plus,
  Search,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  BeneficiaryCategory,
  BeneficiaryCohort,
  Role,
  ServiceDeliveryStatus,
} from "@/generated/prisma/enums";
import { CohortMultiSelect } from "@/components/beneficiaries/CohortMultiSelect";
import {
  BENEFICIARY_CATEGORY_LABELS,
  BENEFICIARY_COHORT_LABELS,
  formatCurrency,
  isRecheckOverdue,
  RECHECK_WINDOW_DAYS,
} from "@/lib/service-portal-utils";
import {
  getDeliveryDisplayColor,
  getDeliveryDisplayLabel,
  ID_DOCUMENT_LABELS,
} from "@/lib/delivery-progress";
import { StatusPill, UrgentBadge, CaseStudyBadge, ObjectionBadge, RemovedBadge } from "./StatusPill";
import {
  DeliveryAction,
  DeliveryProgressPanel,
} from "./DeliveryProgressPanel";
import { BeneficiaryFeedbackSection } from "./BeneficiaryFeedbackSection";
import { SatisfactionPromptModal } from "./SatisfactionPromptModal";
import { WalkthroughHost } from "@/components/ui/WalkthroughHost";
import { getPortalEligibleProjects, ProjectProposal } from "@/lib/projects";
import {
  formatProjectType,
  projectRequiresServiceOnEnrollment,
} from "@/lib/projectMeta";
import { canManageDelivery } from "@/lib/delivery-permissions";
import {
  exportBeneficiariesExcel,
  exportSingleBeneficiaryExcel,
} from "@/lib/beneficiaryExport";
import { hasFeature } from "@/lib/role-features";

interface ServicePortalViewProps {
  userId: string;
  userRole: Role;
  userName: string;
  canManageServices: boolean;
  initialProjectId?: string;
  initialTab?: string;
}

type PortalTab = "beneficiaries" | "add" | "recheck" | "services" | "detail";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: Array<{ id: string; stepOrder: number; name: string; description: string | null }>;
  _count?: { deliveries: number };
}

interface ServiceStep {
  id: string;
  stepOrder: number;
  name: string;
  description: string | null;
}

interface DeliverySummary {
  id: string;
  status: ServiceDeliveryStatus;
  recheckDueDate: string;
  recheckedAt: string | null;
  notes: string | null;
  createdAt: string;
  objectionActive: boolean;
  objectionNote: string | null;
  currentStepId: string | null;
  currentStep?: ServiceStep | null;
  stepProgress?: Array<{ stepId: string; completedAt: string; completedBy?: { name: string } }>;
  service: { id: string; name: string; steps?: ServiceStep[] } | null;
  enteredBy?: { id: string; name: string };
  recheckedBy?: { id: string; name: string } | null;
  objectionRaisedBy?: { id: string; name: string } | null;
}

interface BeneficiarySummary {
  id: string;
  beneficiaryCode: string;
  projectId: string | null;
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
  cohorts?: BeneficiaryCohort[];
  monthlyIncome: number | null;
  familyMembers: number | null;
  location: string | null;
  isUrgentCase: boolean;
  isCaseStudy: boolean;
  isRemoved?: boolean;
  removedAt?: string | null;
  notes: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string };
  deliveries?: DeliverySummary[];
  followUps?: FollowUpItem[];
  _count?: { deliveries: number };
}

interface FollowUpItem {
  id: string;
  note: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  delivery: { id: string; service: { name: string } } | null;
}

interface RecheckItem extends DeliverySummary {
  beneficiary: {
    id: string;
    name: string;
    beneficiaryCode: string;
    mobile: string | null;
    isUrgentCase: boolean;
  };
  enteredBy: { id: string; name: string };
}

type BeneficiaryFilter = "all" | "urgent" | "case_study" | "removed";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const EMPTY_FORM = {
  name: "",
  age: "",
  gender: "",
  mobile: "",
  alternateMobile: "",
  idDocumentType: "",
  idDocumentNumber: "",
  pincode: "",
  address: "",
  category: "GENERAL" as BeneficiaryCategory,
  cohorts: [] as BeneficiaryCohort[],
  monthlyIncome: "",
  familyMembers: "",
  location: "",
  isUrgentCase: false,
  isCaseStudy: false,
  notes: "",
  projectId: "",
  serviceId: "",
};

function deliveryLabel(service: DeliverySummary["service"]) {
  return service?.name ?? "Enrollment status";
}

export function ServicePortalView({
  userId,
  userRole,
  userName,
  canManageServices,
  initialProjectId,
  initialTab,
}: ServicePortalViewProps) {
  const searchParams = useSearchParams();
  const tabFromUrl = initialTab ?? searchParams.get("tab");
  const validTabs: PortalTab[] = ["beneficiaries", "add", "recheck", "services", "detail"];
  const initialPortalTab =
    tabFromUrl && validTabs.includes(tabFromUrl as PortalTab)
      ? (tabFromUrl as PortalTab)
      : "beneficiaries";

  const [tab, setTab] = useState<PortalTab>(initialPortalTab);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [portalProjects, setPortalProjects] = useState<ProjectProposal[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId ?? "");

  const [searchQuery, setSearchQuery] = useState("");
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<BeneficiaryFilter>("all");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiarySummary[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [pendingRechecks, setPendingRechecks] = useState<RecheckItem[]>([]);
  const [overdueRechecks, setOverdueRechecks] = useState<RecheckItem[]>([]);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<BeneficiarySummary | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM, projectId: initialProjectId ?? "" });
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpDeliveryId, setFollowUpDeliveryId] = useState("");
  const [addServiceId, setAddServiceId] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    mobile: "",
    alternateMobile: "",
    idDocumentType: "",
    idDocumentNumber: "",
    pincode: "",
    age: "",
    gender: "",
    category: "GENERAL" as BeneficiaryCategory,
    cohorts: [] as BeneficiaryCohort[],
    monthlyIncome: "",
    familyMembers: "",
    location: "",
    address: "",
    notes: "",
    isUrgentCase: false,
    isCaseStudy: false,
  });

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");
  const [newStepName, setNewStepName] = useState("");
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [satisfactionPrompt, setSatisfactionPrompt] = useState<{
    beneficiaryId: string;
    beneficiaryName: string;
    serviceName?: string;
  } | null>(null);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const selectedProject = portalProjects.find((p) => p.id === selectedProjectId);
  const serviceRequiredOnEnrollment = selectedProject
    ? projectRequiresServiceOnEnrollment(selectedProject.projectType)
    : true;

  useEffect(() => {
    setPortalProjects(getPortalEligibleProjects());
  }, []);

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
      setForm((prev) => ({ ...prev, projectId: initialProjectId }));
    }
  }, [initialProjectId]);

  const resolveProjectTitle = (projectId: string | null | undefined) => {
    if (!projectId) return null;
    return portalProjects.find((p) => p.id === projectId)?.title ?? projectId;
  };

  const loadBeneficiaries = useCallback(async (q?: string, projectId?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    else if (projectId) params.set("projectId", projectId);
    if (beneficiaryFilter === "urgent") params.set("urgentOnly", "1");
    if (beneficiaryFilter === "case_study") params.set("caseStudyOnly", "1");
    if (beneficiaryFilter === "removed") params.set("removedOnly", "1");
    const qs = params.toString();
    const res = await fetch(`/api/beneficiaries${qs ? `?${qs}` : ""}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error ??
          (res.status === 403
            ? "Session expired or no access. Please log in again."
            : `Failed to load beneficiaries (${res.status})`)
      );
    }
    setBeneficiaries(data.beneficiaries);
  }, [beneficiaryFilter]);

  const loadServices = useCallback(async () => {
    const res = await fetch("/api/services");
    if (!res.ok) throw new Error("Failed to load services");
    const data = await res.json();
    setServices(data.services);
  }, []);

  const loadRecheckQueue = useCallback(async (projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await fetch(`/api/service-deliveries/recheck-queue${qs}`);
    if (!res.ok) throw new Error("Failed to load recheck queue");
    const data = await res.json();
    setPendingRechecks(data.pending);
    setOverdueRechecks(data.overdue);
  }, []);

  const listProjectId = searchQuery ? undefined : selectedProjectId || undefined;

  const loadBeneficiaryDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/beneficiaries/${id}`);
    if (!res.ok) throw new Error("Failed to load beneficiary");
    const data = await res.json();
    setSelectedBeneficiary(data.beneficiary);
    setEditingProfile(false);
  }, []);

  async function handleExportBeneficiaryList() {
    setLoading(true);
    clearMessages();
    try {
      const params = new URLSearchParams({ export: "1", includeDeliveries: "1" });
      if (searchQuery) params.set("q", searchQuery);
      else if (selectedProjectId) params.set("projectId", selectedProjectId);
      if (beneficiaryFilter === "urgent") params.set("urgentOnly", "1");
      if (beneficiaryFilter === "case_study") params.set("caseStudyOnly", "1");

      const res = await fetch(`/api/beneficiaries?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed");

      const rows = (data.beneficiaries as BeneficiarySummary[]).map((b) => ({
        ...b,
        projectTitle: resolveProjectTitle(b.projectId) ?? undefined,
      }));
      exportBeneficiariesExcel(rows, {
        filterLabel: beneficiaryFilter !== "all" ? beneficiaryFilter : undefined,
        projectTitle: selectedProject?.title,
      });
      setSuccess(`Exported ${rows.length} beneficiaries to Excel`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  function handleExportSingleBeneficiary() {
    if (!selectedBeneficiary) return;
    exportSingleBeneficiaryExcel({
      ...selectedBeneficiary,
      projectTitle: resolveProjectTitle(selectedBeneficiary.projectId) ?? undefined,
    });
    setSuccess("Beneficiary exported to Excel");
  }

  function startEditProfile(b: BeneficiarySummary) {
    setEditForm({
      name: b.name,
      mobile: b.mobile ?? "",
      alternateMobile: b.alternateMobile ?? "",
      idDocumentType: b.idDocumentType ?? "",
      idDocumentNumber: b.idDocumentNumber ?? "",
      pincode: b.pincode ?? "",
      age: b.age != null ? String(b.age) : "",
      gender: b.gender ?? "",
      category: b.category,
      cohorts: b.cohorts ?? [],
      monthlyIncome: b.monthlyIncome != null ? String(b.monthlyIncome) : "",
      familyMembers: b.familyMembers != null ? String(b.familyMembers) : "",
      location: b.location ?? "",
      address: b.address ?? "",
      notes: b.notes ?? "",
      isUrgentCase: b.isUrgentCase,
      isCaseStudy: b.isCaseStudy,
    });
    setEditingProfile(true);
  }

  const handleUpdateBeneficiary = async (beneficiaryId: string) => {
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          mobile: editForm.mobile || undefined,
          alternateMobile: editForm.alternateMobile || undefined,
          idDocumentType: editForm.idDocumentType || undefined,
          idDocumentNumber: editForm.idDocumentNumber || undefined,
          pincode: editForm.pincode || undefined,
          age: editForm.age ? Number(editForm.age) : undefined,
          gender: editForm.gender || undefined,
          category: editForm.category,
          cohorts: editForm.cohorts,
          monthlyIncome: editForm.monthlyIncome ? Number(editForm.monthlyIncome) : undefined,
          familyMembers: editForm.familyMembers ? Number(editForm.familyMembers) : undefined,
          location: editForm.location || undefined,
          address: editForm.address || undefined,
          notes: editForm.notes || undefined,
          isUrgentCase: editForm.isUrgentCase,
          isCaseStudy: editForm.isCaseStudy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update beneficiary");

      setSuccess("Beneficiary profile updated");
      setEditingProfile(false);
      await loadBeneficiaryDetail(beneficiaryId);
      await loadBeneficiaries(searchQuery || undefined, listProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      await Promise.all([
        loadBeneficiaries(searchQuery || undefined, listProjectId),
        loadServices(),
        loadRecheckQueue(selectedProjectId || undefined),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [loadBeneficiaries, loadServices, loadRecheckQueue, searchQuery, listProjectId, selectedProjectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      await loadBeneficiaries(searchQuery || undefined, searchQuery ? undefined : selectedProjectId || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          mobile: form.mobile || undefined,
          alternateMobile: form.alternateMobile || undefined,
          idDocumentType: form.idDocumentType || undefined,
          idDocumentNumber: form.idDocumentNumber || undefined,
          pincode: form.pincode || undefined,
          address: form.address || undefined,
          category: form.category,
          cohorts: form.cohorts,
          monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
          familyMembers: form.familyMembers ? Number(form.familyMembers) : undefined,
          location: form.location || undefined,
          isUrgentCase: form.isUrgentCase,
          isCaseStudy: form.isCaseStudy,
          notes: form.notes || undefined,
          projectId: form.projectId,
          serviceId: form.serviceId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add beneficiary");

      setSuccess(`Beneficiary ${data.beneficiary.beneficiaryCode} saved. Follow-up due within ${RECHECK_WINDOW_DAYS} days.`);
      setForm({ ...EMPTY_FORM, projectId: selectedProjectId });
      setShowMoreDetails(false);
      await refresh();
      setTab("beneficiaries");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add beneficiary");
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryAction = async (
    deliveryId: string,
    action: DeliveryAction,
    note?: string
  ) => {
    setLoading(true);
    clearMessages();
    try {
      const body: Record<string, string> = { action };
      if (action === "objection" && note) body.note = note;
      if (action === "clear_objection" && note) body.resolutionNote = note;
      if (action === "reject" && note) body.note = note;
      if (action === "advance_step" && note) body.note = note;

      const res = await fetch(`/api/service-deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update delivery");

      setSuccess(
        action === "objection"
          ? "Objection recorded"
          : action === "clear_objection"
            ? "Objection cleared"
            : action === "advance_step"
              ? `Step completed — ${getDeliveryDisplayLabel(data.delivery)}`
              : `Updated — ${getDeliveryDisplayLabel(data.delivery)}`
      );

      if (
        action === "advance_step" &&
        data.delivery?.status === "COMPLETED" &&
        selectedBeneficiary
      ) {
        setSatisfactionPrompt({
          beneficiaryId: selectedBeneficiary.id,
          beneficiaryName: selectedBeneficiary.name,
          serviceName: data.delivery?.service?.name,
        });
      }
      if (selectedBeneficiary) {
        await loadBeneficiaryDetail(selectedBeneficiary.id);
      }
      await loadRecheckQueue(selectedProjectId || undefined);
      await loadBeneficiaries(searchQuery || undefined, listProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowUp = async (beneficiaryId: string) => {
    if (!followUpNote.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "follow_up",
          note: followUpNote,
          deliveryId: followUpDeliveryId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add follow-up");

      setFollowUpNote("");
      setFollowUpDeliveryId("");
      setSuccess("Follow-up recorded");
      await loadBeneficiaryDetail(beneficiaryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add follow-up");
    } finally {
      setLoading(false);
    }
  };

  const handleAddServiceToBeneficiary = async (beneficiaryId: string) => {
    if (!addServiceId) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_service", serviceId: addServiceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add service");

      setAddServiceId("");
      setSuccess("New service added for beneficiary");
      await loadBeneficiaryDetail(beneficiaryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add service");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServiceName, description: newServiceDesc || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create service");

      setNewServiceName("");
      setNewServiceDesc("");
      setSuccess(`Service "${data.service.name}" created`);
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = async (serviceId: string) => {
    if (!newStepName.trim()) return;
    const service = services.find((s) => s.id === serviceId);
    const nextOrder = (service?.steps.length ?? 0) + 1;

    setLoading(true);
    clearMessages();
    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStepName, stepOrder: nextOrder }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add step");

      setNewStepName("");
      setSuccess("Step added");
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add step");
    } finally {
      setLoading(false);
    }
  };

  const tabs: Array<{ id: PortalTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: "beneficiaries", label: "People", icon: <Users className="h-4 w-4" /> },
    { id: "add", label: "Add New", icon: <UserPlus className="h-4 w-4" /> },
    {
      id: "recheck",
      label: "Follow-ups",
      icon: <Clock className="h-4 w-4" />,
      badge: overdueRechecks.length + pendingRechecks.length,
    },
  ];

  if (canManageServices) {
    tabs.push({ id: "services", label: "Services", icon: <Settings className="h-4 w-4" /> });
  }

  const activeServices = services.filter((s) => s.isActive);

  const filteredBeneficiaries = beneficiaries;

  async function handleToggleRemoved(beneficiaryId: string, nextRemoved: boolean) {
    setLoading(true);
    clearMessages();
    try {
      const res = await fetch(`/api/beneficiaries/${beneficiaryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRemoved: nextRemoved }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update removal status");
      setSuccess(nextRemoved ? "Marked as removed" : "Restored beneficiary");
      await loadBeneficiaryDetail(beneficiaryId);
      await loadBeneficiaries(searchQuery || undefined, listProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  const totalServicesDelivered = beneficiaries.reduce(
    (sum, b) => sum + (b._count?.deliveries ?? b.deliveries?.length ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <WalkthroughHost module="beneficiaries" />
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Beneficiaries</h1>
        <p className="mt-1 text-sm text-slate-600">
          Register people, track services, and manage follow-ups — {userName}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Beneficiaries</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{beneficiaries.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Services</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalServicesDelivered}</p>
          <p className="text-xs text-slate-500">Across all beneficiaries</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Follow-ups</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{pendingRechecks.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{overdueRechecks.length}</p>
        </Card>
      </div>

      {(error || success) && (
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            error ? "bg-red-50 text-red-800" : "bg-brand-mist text-brand-teal-dark"
          )}
        >
          {error || success}
        </div>
      )}

      <Card className="p-4">
        <Label>Project</Label>
        <select
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={selectedProjectId}
          onChange={(e) => {
            const nextId = e.target.value;
            setSelectedProjectId(nextId);
            setForm((prev) => ({ ...prev, projectId: nextId, serviceId: "" }));
          }}
        >
          <option value="">All projects (legacy + unscoped)</option>
          {portalProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || "Untitled"} — {formatProjectType(p.projectType)}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-slate-500">
          {selectedProjectId
            ? `Showing enrollments for "${selectedProject?.title ?? "project"}".`
            : "Select a project to register and filter beneficiaries by program."}
        </p>
        {portalProjects.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">
            No approved projects eligible for enrollment. Approve an Enrollment Tracking or Service Delivery project first.
          </p>
        )}
      </Card>

      <div className="tab-bar-mobile flex gap-1 border-b border-slate-200 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              clearMessages();
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:px-4",
              tab === t.id
                ? "border-b-2 border-brand-red text-brand-teal-dark"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {t.icon}
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "beneficiaries" && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search by ID (BNF-000001), mobile number, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              Search
            </Button>
          </form>
          <p className="text-xs text-slate-500">
            Search by ID or mobile works across all projects. Clear search to filter by the selected project above.
          </p>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "urgent" as const, label: "Urgent Cases" },
                { id: "case_study" as const, label: "Case Studies" },
                { id: "removed" as const, label: "Removed" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBeneficiaryFilter(f.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  beneficiaryFilter === f.id
                    ? "bg-brand-red text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="ml-auto gap-1.5"
              disabled={loading}
              onClick={handleExportBeneficiaryList}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>

          <div className="grid gap-4">
            {filteredBeneficiaries.length === 0 && (
              <Card className="text-center text-slate-500">
                No beneficiaries found. Add one to get started.
              </Card>
            )}
            {filteredBeneficiaries.map((b) => (
              <Card
                key={b.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => loadBeneficiaryDetail(b.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-brand-teal-dark">
                        {b.beneficiaryCode}
                      </span>
                      {b.isRemoved && <RemovedBadge />}
                      {b.isUrgentCase && <UrgentBadge />}
                      {b.isCaseStudy && <CaseStudyBadge />}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">{b.name}</h3>
                    {b.projectId && (
                      <p className="text-xs font-medium text-brand-teal-dark">
                        {resolveProjectTitle(b.projectId)}
                      </p>
                    )}
                    <p className="text-sm text-slate-600">
                      {b.mobile && `📱 ${b.mobile}`}
                      {b.location && ` · ${b.location}`}
                      {b.category && ` · ${BENEFICIARY_CATEGORY_LABELS[b.category]}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">
                      {b._count?.deliveries ?? b.deliveries?.length ?? 0} service(s)
                    </p>
                    <p className="text-xs text-slate-500">Added {formatDate(b.createdAt)}</p>
                  </div>
                </div>
                {b.deliveries && b.deliveries.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.deliveries.map((d) => (
                      <span
                        key={d.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs"
                      >
                        {deliveryLabel(d.service)}
                        <StatusPill
                          label={getDeliveryDisplayLabel(d)}
                          className={getDeliveryDisplayColor(d)}
                        />
                        {d.objectionActive && <ObjectionBadge />}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "add" && (
        <Card>
          <CardTitle className="mb-2 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-brand-teal" />
            Quick register
          </CardTitle>
          <p className="mb-4 text-sm text-slate-500">
            Enter the essentials now. You can add full details anytime from the person&apos;s profile.
          </p>
          <form onSubmit={handleAddBeneficiary} className="space-y-4">
            <div>
              <Label>Project *</Label>
              <select
                required
                className="input-brand mt-1.5"
                value={form.projectId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setForm({ ...form, projectId: nextId, serviceId: "" });
                  setSelectedProjectId(nextId);
                }}
              >
                <option value="">Select project</option>
                {portalProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || "Untitled"} — {formatProjectType(p.projectType)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Full name *</Label>
              <Input
                required
                className="mt-1.5"
                placeholder="Beneficiary name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Mobile number</Label>
              <Input
                className="mt-1.5"
                type="tel"
                inputMode="tel"
                placeholder="10-digit mobile"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
            </div>
            <div>
              <Label>Village / location</Label>
              <Input
                className="mt-1.5"
                placeholder="Where they live"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            {serviceRequiredOnEnrollment && (
              <div>
                <Label>Service *</Label>
                <select
                  required
                  className="input-brand mt-1.5"
                  value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                >
                  <option value="">Select service</option>
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowMoreDetails((v) => !v)}
              className="flex w-full min-h-[44px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <span>Want to add more details now?</span>
              {showMoreDetails ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
              )}
            </button>

            {showMoreDetails && (
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
                <div>
                  <Label>Alternate mobile</Label>
                  <Input
                    className="mt-1.5"
                    value={form.alternateMobile}
                    onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })}
                  />
                </div>
                <div>
                  <Label>ID document type</Label>
                  <select
                    className="input-brand mt-1.5"
                    value={form.idDocumentType}
                    onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}
                  >
                    <option value="">Select</option>
                    {Object.entries(ID_DOCUMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>ID number</Label>
                  <Input
                    className="mt-1.5"
                    value={form.idDocumentNumber}
                    onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input className="mt-1.5" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
                </div>
                <div>
                  <Label>Age</Label>
                  <Input type="number" min={0} max={120} className="mt-1.5" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                </div>
                <div>
                  <Label>Gender</Label>
                  <select
                    className="input-brand mt-1.5"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Category</Label>
                  <select
                    className="input-brand mt-1.5"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as BeneficiaryCategory })}
                  >
                    {Object.entries(BENEFICIARY_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Cohorts (select all that apply)</Label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    PwD, migrant, single mother, sanitation worker, minority, etc. — used in special reporting.
                  </p>
                  <CohortMultiSelect
                    className="mt-2"
                    value={form.cohorts}
                    onChange={(cohorts) => setForm({ ...form, cohorts })}
                  />
                </div>
                <div>
                  <Label>Monthly income (₹)</Label>
                  <Input type="number" min={0} className="mt-1.5" value={form.monthlyIncome} onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })} />
                </div>
                <div>
                  <Label>Family members</Label>
                  <Input type="number" min={1} className="mt-1.5" value={form.familyMembers} onChange={(e) => setForm({ ...form, familyMembers: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Full address</Label>
                  <Input className="mt-1.5" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <textarea
                    className="input-brand mt-1.5 resize-y"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:flex-wrap">
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isUrgentCase}
                      onChange={(e) => setForm({ ...form, isUrgentCase: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Urgent case
                  </label>
                  <label className="flex min-h-[44px] items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isCaseStudy}
                      onChange={(e) => setForm({ ...form, isCaseStudy: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <BookOpen className="h-4 w-4 text-purple-500" />
                    Case study
                  </label>
                </div>
              </div>
            )}

            {!serviceRequiredOnEnrollment && (
              <div className="rounded-lg border border-brand-teal/25 bg-brand-mist px-3 py-2 text-sm text-brand-teal-dark">
                Enrollment tracking — status: Data Entered → In Progress → Completed
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={
                loading ||
                !form.projectId ||
                (serviceRequiredOnEnrollment && activeServices.length === 0)
              }
            >
              {loading ? "Saving…" : "Save beneficiary"}
            </Button>
            {serviceRequiredOnEnrollment && activeServices.length === 0 && (
              <p className="text-sm text-amber-700">
                No active services. {canManageServices ? "Add services in the Services tab first." : "Ask a manager to add services."}
              </p>
            )}
          </form>
        </Card>
      )}

      {tab === "recheck" && (
        <div className="space-y-6">
          {overdueRechecks.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Overdue Rechecks ({overdueRechecks.length})
              </h2>
              <div className="grid gap-3">
                {overdueRechecks.map((item) => (
                  <RecheckCard
                    key={item.id}
                    item={item}
                    overdue
                    userId={userId}
                    userRole={userRole}
                    onAction={handleDeliveryAction}
                    onView={() => loadBeneficiaryDetail(item.beneficiary.id)}
                    loading={loading}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Clock className="h-5 w-5 text-amber-600" />
              Pending Rechecks ({pendingRechecks.length})
            </h2>
            {pendingRechecks.length === 0 && overdueRechecks.length === 0 ? (
              <Card className="text-center text-slate-500">No pending rechecks. All caught up!</Card>
            ) : (
              <div className="grid gap-3">
                {pendingRechecks.map((item) => (
                  <RecheckCard
                    key={item.id}
                    item={item}
                    userId={userId}
                    userRole={userRole}
                    onAction={handleDeliveryAction}
                    onView={() => loadBeneficiaryDetail(item.beneficiary.id)}
                    loading={loading}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "services" && canManageServices && (
        <div className="space-y-6">
          <Card>
            <CardTitle className="mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-brand-teal" />
              Add New Service
            </CardTitle>
            <form onSubmit={handleCreateService} className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Service Name *</Label>
                <Input required value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={newServiceDesc} onChange={(e) => setNewServiceDesc(e.target.value)} />
              </div>
              <div>
                <Button type="submit" disabled={loading}>Create Service</Button>
              </div>
            </form>
          </Card>

          <div className="grid gap-4">
            {services.map((service) => (
              <Card key={service.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm text-slate-600">{service.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {service._count?.deliveries ?? 0} deliveries · {service.steps.length} steps
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedServiceId(expandedServiceId === service.id ? null : service.id)
                    }
                    className="text-sm text-brand-teal hover:underline"
                  >
                    {expandedServiceId === service.id ? "Hide steps" : "Manage steps"}
                  </button>
                </div>

                {expandedServiceId === service.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <h4 className="mb-2 text-sm font-medium text-slate-700">Delivery Steps</h4>
                    <ol className="mb-3 space-y-1">
                      {service.steps.map((step) => (
                        <li key={step.id} className="flex items-center gap-2 text-sm text-slate-700">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-mist text-xs font-medium text-brand-teal-dark">
                            {step.stepOrder}
                          </span>
                          {step.name}
                          {step.description && (
                            <span className="text-slate-500">— {step.description}</span>
                          )}
                        </li>
                      ))}
                      {service.steps.length === 0 && (
                        <li className="text-sm text-slate-500">No steps yet. Add delivery steps below.</li>
                      )}
                    </ol>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Step name (e.g. Document verification)"
                        value={newStepName}
                        onChange={(e) => setNewStepName(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={loading}
                        onClick={() => handleAddStep(service.id)}
                      >
                        Add Step
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedBeneficiary && (
        <>
          <button
            type="button"
            aria-label="Close profile"
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setSelectedBeneficiary(null)}
          />
          <div className="detail-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl sm:max-w-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedBeneficiary(null)}>
                ← Close
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={handleExportSingleBeneficiary}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-bold text-brand-teal-dark">
                    {selectedBeneficiary.beneficiaryCode}
                  </span>
                  {selectedBeneficiary.isRemoved && <RemovedBadge />}
                  {selectedBeneficiary.isUrgentCase && <UrgentBadge />}
                  {selectedBeneficiary.isCaseStudy && <CaseStudyBadge />}
                </div>
                {!editingProfile ? (
                  <>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900">{selectedBeneficiary.name}</h2>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                      {selectedBeneficiary.mobile && <p>Mobile: {selectedBeneficiary.mobile}</p>}
                      {selectedBeneficiary.alternateMobile && (
                        <p>Alt. mobile: {selectedBeneficiary.alternateMobile}</p>
                      )}
                      {selectedBeneficiary.idDocumentNumber && (
                        <p>
                          ID: {ID_DOCUMENT_LABELS[selectedBeneficiary.idDocumentType ?? ""] ?? "Document"}{" "}
                          {selectedBeneficiary.idDocumentNumber}
                        </p>
                      )}
                      {selectedBeneficiary.pincode && <p>Pincode: {selectedBeneficiary.pincode}</p>}
                      {selectedBeneficiary.age && <p>Age: {selectedBeneficiary.age}</p>}
                      {selectedBeneficiary.gender && <p>Gender: {selectedBeneficiary.gender}</p>}
                      <p>Category: {BENEFICIARY_CATEGORY_LABELS[selectedBeneficiary.category]}</p>
                      {(selectedBeneficiary.cohorts?.length ?? 0) > 0 && (
                        <p className="sm:col-span-2">
                          Cohorts:{" "}
                          {selectedBeneficiary.cohorts!
                            .map((c) => BENEFICIARY_COHORT_LABELS[c])
                            .join(", ")}
                        </p>
                      )}
                      <p>Income: {formatCurrency(selectedBeneficiary.monthlyIncome)}/mo</p>
                      {selectedBeneficiary.familyMembers && (
                        <p>Family: {selectedBeneficiary.familyMembers} members</p>
                      )}
                      {selectedBeneficiary.location && <p>Location: {selectedBeneficiary.location}</p>}
                      {selectedBeneficiary.address && <p>Address: {selectedBeneficiary.address}</p>}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Name</Label>
                      <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Mobile</Label>
                      <Input value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
                    </div>
                    <div>
                      <Label>Age</Label>
                      <Input type="number" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} />
                    </div>
                    <div>
                      <Label>Gender</Label>
                      <Input value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value as BeneficiaryCategory })}
                      >
                        {Object.entries(BENEFICIARY_CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Cohorts</Label>
                      <CohortMultiSelect
                        className="mt-2"
                        value={editForm.cohorts}
                        onChange={(cohorts) => setEditForm({ ...editForm, cohorts })}
                      />
                    </div>
                    <div>
                      <Label>Monthly Income (₹)</Label>
                      <Input type="number" value={editForm.monthlyIncome} onChange={(e) => setEditForm({ ...editForm, monthlyIncome: e.target.value })} />
                    </div>
                    <div>
                      <Label>Family Members</Label>
                      <Input type="number" value={editForm.familyMembers} onChange={(e) => setEditForm({ ...editForm, familyMembers: e.target.value })} />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Address</Label>
                      <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                    <div className="flex flex-wrap gap-4 sm:col-span-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editForm.isUrgentCase} onChange={(e) => setEditForm({ ...editForm, isUrgentCase: e.target.checked })} />
                        Urgent case
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editForm.isCaseStudy} onChange={(e) => setEditForm({ ...editForm, isCaseStudy: e.target.checked })} />
                        Case study
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>Registered {formatDate(selectedBeneficiary.createdAt)}</p>
                {selectedBeneficiary.createdBy && (
                  <p>By {selectedBeneficiary.createdBy.name}</p>
                )}
                <p className="mt-1 font-medium text-slate-700">
                  Total services: {selectedBeneficiary.deliveries?.length ?? 0}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  {!editingProfile ? (
                    <>
                      {hasFeature(userRole, "beneficiaries.manage") && (
                        <Button
                          size="sm"
                          variant={selectedBeneficiary.isRemoved ? "secondary" : "ghost"}
                          disabled={loading}
                          onClick={() =>
                            handleToggleRemoved(selectedBeneficiary.id, !Boolean(selectedBeneficiary.isRemoved))
                          }
                        >
                          {selectedBeneficiary.isRemoved ? "Restore" : "Mark removed"}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => startEditProfile(selectedBeneficiary)}>
                        Edit profile
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => handleUpdateBeneficiary(selectedBeneficiary.id)} disabled={loading}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingProfile(false)}>
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-teal" />
              Service Deliveries
            </CardTitle>
            <div className="mb-4 flex flex-wrap gap-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={addServiceId}
                onChange={(e) => setAddServiceId(e.target.value)}
              >
                <option value="">Add another service...</option>
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={!addServiceId || loading}
                onClick={() => handleAddServiceToBeneficiary(selectedBeneficiary.id)}
              >
                Add Service
              </Button>
            </div>

            <div className="space-y-4">
              {(selectedBeneficiary.deliveries ?? []).map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-200 p-4">
                  <h4 className="mb-3 font-semibold text-slate-900">{deliveryLabel(d.service)}</h4>
                  <DeliveryProgressPanel
                    delivery={d}
                    loading={loading}
                    canManageDelivery={canManageDelivery(
                      userRole,
                      userId,
                      d.enteredBy?.id ?? ""
                    )}
                    showRecheckDue={d.status === "DATA_ENTERED"}
                    recheckOverdue={isRecheckOverdue(d.recheckDueDate)}
                    recheckDueLabel={`Recheck by ${formatDate(d.recheckDueDate)}${
                      !isRecheckOverdue(d.recheckDueDate)
                        ? ` (${daysUntil(d.recheckDueDate)} days left)`
                        : " — overdue"
                    }`}
                    onAction={handleDeliveryAction}
                  />
                </div>
              ))}
            </div>
          </Card>

          <BeneficiaryFeedbackSection
            beneficiaryId={selectedBeneficiary.id}
            onFlash={(msg, err) => (err ? setError(msg) : setSuccess(msg))}
          />

          <Card>
            <CardTitle className="mb-3">Follow-ups</CardTitle>
            <div className="mb-4 space-y-2">
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                rows={2}
                placeholder="Add follow-up note for this beneficiary..."
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={followUpDeliveryId}
                  onChange={(e) => setFollowUpDeliveryId(e.target.value)}
                >
                  <option value="">Link to service (optional)</option>
                  {(selectedBeneficiary.deliveries ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{deliveryLabel(d.service)}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!followUpNote.trim() || loading}
                  onClick={() => handleAddFollowUp(selectedBeneficiary.id)}
                >
                  Add Follow-up
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {(selectedBeneficiary.followUps ?? []).length === 0 && (
                <p className="text-sm text-slate-500">No follow-ups yet.</p>
              )}
              {(selectedBeneficiary.followUps ?? []).map((f) => (
                <div key={f.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">{f.note}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {f.createdBy.name} · {formatDate(f.createdAt)}
                    {f.delivery && ` · ${deliveryLabel(f.delivery.service as DeliverySummary["service"])}`}
                  </p>
                </div>
              ))}
            </div>
          </Card>
            </div>
          </div>
        </>
      )}

      {tab === "beneficiaries" && (
        <button
          type="button"
          onClick={() => setTab("add")}
          className="fixed bottom-6 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-red text-white shadow-lg shadow-brand-red/30 hover:bg-brand-red-dark active:scale-95 lg:hidden"
          aria-label="Add beneficiary"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {satisfactionPrompt && (
        <SatisfactionPromptModal
          beneficiaryId={satisfactionPrompt.beneficiaryId}
          beneficiaryName={satisfactionPrompt.beneficiaryName}
          serviceName={satisfactionPrompt.serviceName}
          onClose={() => setSatisfactionPrompt(null)}
        />
      )}
    </div>
  );
}

function RecheckCard({
  item,
  overdue,
  userId,
  userRole,
  onAction,
  onView,
  loading,
}: {
  item: RecheckItem;
  overdue?: boolean;
  userId: string;
  userRole: Role;
  onAction: (id: string, action: DeliveryAction, note?: string) => void;
  onView: () => void;
  loading: boolean;
}) {
  return (
    <Card className={cn(overdue && "border-red-200 bg-red-50/30")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-brand-teal-dark">
              {item.beneficiary.beneficiaryCode}
            </span>
            {item.beneficiary.isUrgentCase && <UrgentBadge />}
          </div>
          <h3 className="font-semibold text-slate-900">{item.beneficiary.name}</h3>
          <p className="text-sm text-slate-600">
            {deliveryLabel(item.service)}
            {item.beneficiary.mobile && ` · ${item.beneficiary.mobile}`}
          </p>
          <DeliveryProgressPanel
            delivery={item}
            loading={loading}
            compact
            canManageDelivery={canManageDelivery(userRole, userId, item.enteredBy.id)}
            showRecheckDue
            recheckOverdue={overdue}
            recheckDueLabel={
              overdue
                ? `Overdue since ${formatDate(item.recheckDueDate)}`
                : `Due ${formatDate(item.recheckDueDate)} (${daysUntil(item.recheckDueDate)} days left)`
            }
            onAction={onAction}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={onView} className="shrink-0">
          View
        </Button>
      </div>
    </Card>
  );
}

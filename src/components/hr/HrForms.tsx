"use client";

import { Input, Label } from "@/components/ui/Input";
import {
  DEFAULT_HR_POLICY,
  HrPolicyBundle,
  McaEmployeeProfile,
} from "@/lib/hr-types";

interface HrPolicySettingsFormProps {
  value: HrPolicyBundle;
  onChange: (value: HrPolicyBundle) => void;
  readOnly?: boolean;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
      {children}
    </h3>
  );
}

export function HrPolicySettingsForm({ value, onChange, readOnly }: HrPolicySettingsFormProps) {
  const v = value ?? DEFAULT_HR_POLICY;

  function setPayroll(field: keyof HrPolicyBundle["payroll"], val: string | boolean) {
    onChange({
      ...v,
      payroll: {
        ...v.payroll,
        [field]: typeof val === "boolean" ? val : Number(val),
      },
    });
  }

  function setLeave(field: keyof HrPolicyBundle["leave"], val: string | boolean) {
    onChange({
      ...v,
      leave: {
        ...v.leave,
        [field]: typeof val === "boolean" ? val : Number(val),
      },
    });
  }

  function setLateMark(field: keyof HrPolicyBundle["lateMark"], val: string) {
    onChange({
      ...v,
      lateMark: {
        ...v.lateMark,
        [field]:
          field === "officeStartTime" || field === "officeEndTime" ? val : Number(val),
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Payroll Settings</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Pay cycle day (1–28)</Label>
            <Input type="number" min={1} max={28} disabled={readOnly} value={v.payroll.payCycleDay}
              onChange={(e) => setPayroll("payCycleDay", e.target.value)} />
          </div>
          <div>
            <Label>PF employee %</Label>
            <Input type="number" step="0.01" disabled={readOnly} value={v.payroll.pfEmployeePercent}
              onChange={(e) => setPayroll("pfEmployeePercent", e.target.value)} />
          </div>
          <div>
            <Label>PF employer %</Label>
            <Input type="number" step="0.01" disabled={readOnly} value={v.payroll.pfEmployerPercent}
              onChange={(e) => setPayroll("pfEmployerPercent", e.target.value)} />
          </div>
          <div>
            <Label>ESI employee %</Label>
            <Input type="number" step="0.01" disabled={readOnly} value={v.payroll.esiEmployeePercent}
              onChange={(e) => setPayroll("esiEmployeePercent", e.target.value)} />
          </div>
          <div>
            <Label>ESI employer %</Label>
            <Input type="number" step="0.01" disabled={readOnly} value={v.payroll.esiEmployerPercent}
              onChange={(e) => setPayroll("esiEmployerPercent", e.target.value)} />
          </div>
          <div>
            <Label>Professional tax (₹)</Label>
            <Input type="number" disabled={readOnly} value={v.payroll.professionalTax}
              onChange={(e) => setPayroll("professionalTax", e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <input type="checkbox" id="tdsApplicable" disabled={readOnly} checked={v.payroll.tdsApplicable}
              onChange={(e) => setPayroll("tdsApplicable", e.target.checked)} className="h-4 w-4 rounded" />
            <Label htmlFor="tdsApplicable">TDS applicable</Label>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Leave Settings</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Casual leave (days/year)</Label>
            <Input type="number" disabled={readOnly} value={v.leave.casualLeaveDays}
              onChange={(e) => setLeave("casualLeaveDays", e.target.value)} />
          </div>
          <div>
            <Label>Sick leave (days/year)</Label>
            <Input type="number" disabled={readOnly} value={v.leave.sickLeaveDays}
              onChange={(e) => setLeave("sickLeaveDays", e.target.value)} />
          </div>
          <div>
            <Label>Earned leave (days/year)</Label>
            <Input type="number" disabled={readOnly} value={v.leave.earnedLeaveDays}
              onChange={(e) => setLeave("earnedLeaveDays", e.target.value)} />
          </div>
          <div>
            <Label>Max carry forward days</Label>
            <Input type="number" disabled={readOnly} value={v.leave.maxCarryForwardDays}
              onChange={(e) => setLeave("maxCarryForwardDays", e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <input type="checkbox" id="carryForward" disabled={readOnly} checked={v.leave.carryForwardEnabled}
              onChange={(e) => setLeave("carryForwardEnabled", e.target.checked)} className="h-4 w-4 rounded" />
            <Label htmlFor="carryForward">Allow carry forward</Label>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Late Mark Settings</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Office start (HH:mm)</Label>
            <Input type="time" disabled={readOnly} value={v.lateMark.officeStartTime}
              onChange={(e) => setLateMark("officeStartTime", e.target.value)} />
          </div>
          <div>
            <Label>Office end (HH:mm)</Label>
            <Input type="time" disabled={readOnly} value={v.lateMark.officeEndTime}
              onChange={(e) => setLateMark("officeEndTime", e.target.value)} />
          </div>
          <div>
            <Label>Grace period (mins)</Label>
            <Input type="number" disabled={readOnly} value={v.lateMark.gracePeriodMins}
              onChange={(e) => setLateMark("gracePeriodMins", e.target.value)} />
          </div>
          <div>
            <Label>Late mark after (mins)</Label>
            <Input type="number" disabled={readOnly} value={v.lateMark.lateMarkAfterMins}
              onChange={(e) => setLateMark("lateMarkAfterMins", e.target.value)} />
          </div>
          <div>
            <Label>Half day after (mins late)</Label>
            <Input type="number" disabled={readOnly} value={v.lateMark.halfDayAfterMins}
              onChange={(e) => setLateMark("halfDayAfterMins", e.target.value)} />
          </div>
          <div>
            <Label>Max late marks / month</Label>
            <Input type="number" disabled={readOnly} value={v.lateMark.maxLateMarksPerMonth}
              onChange={(e) => setLateMark("maxLateMarksPerMonth", e.target.value)} />
          </div>
          <div>
            <Label>Deduction per late mark (₹)</Label>
            <Input type="number" disabled={readOnly} value={v.lateMark.lateDeductionPerMark}
              onChange={(e) => setLateMark("lateDeductionPerMark", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const EMPTY_MCA_PROFILE: McaEmployeeProfile = {};

interface EmployeeProfileFormProps {
  value: McaEmployeeProfile;
  onChange: (value: McaEmployeeProfile) => void;
  readOnly?: boolean;
  showSalary?: boolean;
}

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function EmployeeProfileForm({
  value,
  onChange,
  readOnly,
  showSalary = true,
}: EmployeeProfileFormProps) {
  function set(field: keyof McaEmployeeProfile, val: string) {
    onChange({ ...value, [field]: val || undefined });
  }

  function setNum(field: keyof McaEmployeeProfile, val: string) {
    onChange({ ...value, [field]: val ? Number(val) : undefined });
  }

  return (
    <div className="space-y-6">
      <FieldSection title="Employment (MCA Register)">
        <div>
          <Label>Employee code</Label>
          <Input disabled={readOnly} value={value.employeeCode ?? ""} onChange={(e) => set("employeeCode", e.target.value)} />
        </div>
        <div>
          <Label>Designation</Label>
          <Input disabled={readOnly} value={value.designation ?? ""} onChange={(e) => set("designation", e.target.value)} />
        </div>
        <div>
          <Label>Department</Label>
          <Input disabled={readOnly} value={value.department ?? ""} onChange={(e) => set("department", e.target.value)} />
        </div>
        <div>
          <Label>Employment type</Label>
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={readOnly}
            value={value.employmentType ?? "PERMANENT"} onChange={(e) => set("employmentType", e.target.value)}>
            <option value="PERMANENT">Permanent</option>
            <option value="CONTRACT">Contract</option>
            <option value="PROBATION">Probation</option>
            <option value="INTERN">Intern</option>
          </select>
        </div>
        <div>
          <Label>Date of joining</Label>
          <Input type="date" disabled={readOnly} value={value.joinDate ?? ""} onChange={(e) => set("joinDate", e.target.value)} />
        </div>
        <div>
          <Label>Confirmation date</Label>
          <Input type="date" disabled={readOnly} value={value.confirmationDate ?? ""} onChange={(e) => set("confirmationDate", e.target.value)} />
        </div>
        <div>
          <Label>Probation end date</Label>
          <Input type="date" disabled={readOnly} value={value.probationEndDate ?? ""} onChange={(e) => set("probationEndDate", e.target.value)} />
        </div>
        <div>
          <Label>Work location</Label>
          <Input disabled={readOnly} value={value.workLocation ?? ""} onChange={(e) => set("workLocation", e.target.value)} />
        </div>
      </FieldSection>

      <FieldSection title="Personal Details">
        <div>
          <Label>Father / Spouse name</Label>
          <Input disabled={readOnly} value={value.fatherOrSpouseName ?? ""} onChange={(e) => set("fatherOrSpouseName", e.target.value)} />
        </div>
        <div>
          <Label>Date of birth</Label>
          <Input type="date" disabled={readOnly} value={value.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
        </div>
        <div>
          <Label>Gender</Label>
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={readOnly}
            value={value.gender ?? ""} onChange={(e) => set("gender", e.target.value)}>
            <option value="">Select...</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <Label>Marital status</Label>
          <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" disabled={readOnly}
            value={value.maritalStatus ?? ""} onChange={(e) => set("maritalStatus", e.target.value)}>
            <option value="">Select...</option>
            <option value="SINGLE">Single</option>
            <option value="MARRIED">Married</option>
            <option value="DIVORCED">Divorced</option>
            <option value="WIDOWED">Widowed</option>
          </select>
        </div>
        <div>
          <Label>Nationality</Label>
          <Input disabled={readOnly} value={value.nationality ?? "Indian"} onChange={(e) => set("nationality", e.target.value)} />
        </div>
        <div>
          <Label>Blood group</Label>
          <Input disabled={readOnly} value={value.bloodGroup ?? ""} onChange={(e) => set("bloodGroup", e.target.value)} />
        </div>
      </FieldSection>

      <FieldSection title="Statutory IDs">
        <div>
          <Label>PAN</Label>
          <Input disabled={readOnly} value={value.panNumber ?? ""} onChange={(e) => set("panNumber", e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
        </div>
        <div>
          <Label>Aadhaar</Label>
          <Input disabled={readOnly} value={value.aadhaarNumber ?? ""} onChange={(e) => set("aadhaarNumber", e.target.value)} />
        </div>
        <div>
          <Label>UAN (EPF)</Label>
          <Input disabled={readOnly} value={value.uanNumber ?? ""} onChange={(e) => set("uanNumber", e.target.value)} />
        </div>
        <div>
          <Label>ESIC number</Label>
          <Input disabled={readOnly} value={value.esicNumber ?? ""} onChange={(e) => set("esicNumber", e.target.value)} />
        </div>
        <div>
          <Label>Passport (optional)</Label>
          <Input disabled={readOnly} value={value.passportNumber ?? ""} onChange={(e) => set("passportNumber", e.target.value)} />
        </div>
      </FieldSection>

      <FieldSection title="Address & Emergency">
        <div className="sm:col-span-2">
          <Label>Permanent address</Label>
          <Input disabled={readOnly} value={value.permanentAddress ?? ""} onChange={(e) => set("permanentAddress", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Current address</Label>
          <Input disabled={readOnly} value={value.currentAddress ?? ""} onChange={(e) => set("currentAddress", e.target.value)} />
        </div>
        <div>
          <Label>Emergency contact name</Label>
          <Input disabled={readOnly} value={value.emergencyContactName ?? ""} onChange={(e) => set("emergencyContactName", e.target.value)} />
        </div>
        <div>
          <Label>Emergency contact phone</Label>
          <Input disabled={readOnly} value={value.emergencyContactPhone ?? ""} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
        </div>
      </FieldSection>

      <FieldSection title="Bank Details">
        <div>
          <Label>Bank name</Label>
          <Input disabled={readOnly} value={value.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
        </div>
        <div>
          <Label>Account holder name</Label>
          <Input disabled={readOnly} value={value.bankAccountHolderName ?? ""} onChange={(e) => set("bankAccountHolderName", e.target.value)} />
        </div>
        <div>
          <Label>Account number</Label>
          <Input disabled={readOnly} value={value.bankAccountNumber ?? ""} onChange={(e) => set("bankAccountNumber", e.target.value)} />
        </div>
        <div>
          <Label>IFSC code</Label>
          <Input disabled={readOnly} value={value.bankIfsc ?? ""} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} />
        </div>
      </FieldSection>

      {showSalary && (
        <FieldSection title="Salary Structure">
          <div>
            <Label>CTC (₹/year)</Label>
            <Input type="number" disabled={readOnly} value={value.ctc ?? ""} onChange={(e) => setNum("ctc", e.target.value)} />
          </div>
          <div>
            <Label>Basic salary (₹/month)</Label>
            <Input type="number" disabled={readOnly} value={value.basicSalary ?? ""} onChange={(e) => setNum("basicSalary", e.target.value)} />
          </div>
          <div>
            <Label>HRA (₹/month)</Label>
            <Input type="number" disabled={readOnly} value={value.hra ?? ""} onChange={(e) => setNum("hra", e.target.value)} />
          </div>
          <div>
            <Label>Conveyance (₹/month)</Label>
            <Input type="number" disabled={readOnly} value={value.conveyanceAllowance ?? ""} onChange={(e) => setNum("conveyanceAllowance", e.target.value)} />
          </div>
          <div>
            <Label>Special allowance (₹/month)</Label>
            <Input type="number" disabled={readOnly} value={value.specialAllowance ?? ""} onChange={(e) => setNum("specialAllowance", e.target.value)} />
          </div>
        </FieldSection>
      )}
    </div>
  );
}

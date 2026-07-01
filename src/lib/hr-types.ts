/** MCA-compliant HR policy and employee profile types. */

export interface PayrollSettings {
  payCycleDay: number;
  pfEmployeePercent: number;
  pfEmployerPercent: number;
  esiEmployeePercent: number;
  esiEmployerPercent: number;
  professionalTax: number;
  tdsApplicable: boolean;
}

export interface LeaveSettings {
  casualLeaveDays: number;
  sickLeaveDays: number;
  earnedLeaveDays: number;
  carryForwardEnabled: boolean;
  maxCarryForwardDays: number;
}

export interface LateMarkSettings {
  officeStartTime: string;
  officeEndTime: string;
  gracePeriodMins: number;
  lateMarkAfterMins: number;
  halfDayAfterMins: number;
  maxLateMarksPerMonth: number;
  lateDeductionPerMark: number;
}

export interface HrPolicyBundle {
  payroll: PayrollSettings;
  leave: LeaveSettings;
  lateMark: LateMarkSettings;
}

/** MCA Register of Employees / Form 5 aligned profile fields. */
export interface McaEmployeeProfile {
  employeeCode?: string;
  designation?: string;
  department?: string;
  joinDate?: string;
  confirmationDate?: string;
  employmentType?: "PERMANENT" | "CONTRACT" | "PROBATION" | "INTERN";
  workLocation?: string;
  probationEndDate?: string;

  fatherOrSpouseName?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED";
  nationality?: string;
  bloodGroup?: string;

  permanentAddress?: string;
  currentAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  panNumber?: string;
  aadhaarNumber?: string;
  uanNumber?: string;
  esicNumber?: string;
  passportNumber?: string;

  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountHolderName?: string;

  ctc?: number;
  basicSalary?: number;
  hra?: number;
  conveyanceAllowance?: number;
  specialAllowance?: number;
  baseSalary?: number;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  payCycleDay: 1,
  pfEmployeePercent: 12,
  pfEmployerPercent: 12,
  esiEmployeePercent: 0.75,
  esiEmployerPercent: 3.25,
  professionalTax: 200,
  tdsApplicable: false,
};

export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = {
  casualLeaveDays: 12,
  sickLeaveDays: 10,
  earnedLeaveDays: 15,
  carryForwardEnabled: true,
  maxCarryForwardDays: 30,
};

export const DEFAULT_LATE_MARK_SETTINGS: LateMarkSettings = {
  officeStartTime: "09:30",
  officeEndTime: "18:30",
  gracePeriodMins: 15,
  lateMarkAfterMins: 15,
  halfDayAfterMins: 120,
  maxLateMarksPerMonth: 3,
  lateDeductionPerMark: 0,
};

export const DEFAULT_HR_POLICY: HrPolicyBundle = {
  payroll: DEFAULT_PAYROLL_SETTINGS,
  leave: DEFAULT_LEAVE_SETTINGS,
  lateMark: DEFAULT_LATE_MARK_SETTINGS,
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  PROBATION: "Probation",
  INTERN: "Intern",
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: "Casual Leave",
  SL: "Sick Leave",
  EL: "Earned Leave",
  EM: "Emergency Leave",
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

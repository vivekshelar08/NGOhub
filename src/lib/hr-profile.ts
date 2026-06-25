import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  DEFAULT_HR_POLICY,
  DEFAULT_LATE_MARK_SETTINGS,
  DEFAULT_LEAVE_SETTINGS,
  DEFAULT_PAYROLL_SETTINGS,
  HrPolicyBundle,
  LateMarkSettings,
  LeaveSettings,
  McaEmployeeProfile,
  PayrollSettings,
} from "@/lib/hr-types";
import { decimalToNumber } from "@/lib/hr-utils";

export function toInputJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export function parseJsonField<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  return fallback;
}

export function toDateString(value: Date | null | undefined): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

export function serializePolicyFromDb(record: {
  payCycleDay: number;
  pfEmployeePercent: Prisma.Decimal;
  pfEmployerPercent: Prisma.Decimal;
  esiEmployeePercent: Prisma.Decimal;
  esiEmployerPercent: Prisma.Decimal;
  professionalTax: Prisma.Decimal;
  tdsApplicable: boolean;
  casualLeaveDays: number;
  sickLeaveDays: number;
  earnedLeaveDays: number;
  carryForwardEnabled: boolean;
  maxCarryForwardDays: number;
  officeStartTime: string;
  officeEndTime: string;
  gracePeriodMins: number;
  lateMarkAfterMins: number;
  halfDayAfterMins: number;
  maxLateMarksPerMonth: number;
  lateDeductionPerMark: Prisma.Decimal;
}): HrPolicyBundle {
  return {
    payroll: {
      payCycleDay: record.payCycleDay,
      pfEmployeePercent: decimalToNumber(record.pfEmployeePercent) ?? 12,
      pfEmployerPercent: decimalToNumber(record.pfEmployerPercent) ?? 12,
      esiEmployeePercent: decimalToNumber(record.esiEmployeePercent) ?? 0.75,
      esiEmployerPercent: decimalToNumber(record.esiEmployerPercent) ?? 3.25,
      professionalTax: decimalToNumber(record.professionalTax) ?? 200,
      tdsApplicable: record.tdsApplicable,
    },
    leave: {
      casualLeaveDays: record.casualLeaveDays,
      sickLeaveDays: record.sickLeaveDays,
      earnedLeaveDays: record.earnedLeaveDays,
      carryForwardEnabled: record.carryForwardEnabled,
      maxCarryForwardDays: record.maxCarryForwardDays,
    },
    lateMark: {
      officeStartTime: record.officeStartTime,
      officeEndTime: record.officeEndTime,
      gracePeriodMins: record.gracePeriodMins,
      lateMarkAfterMins: record.lateMarkAfterMins,
      halfDayAfterMins: record.halfDayAfterMins,
      maxLateMarksPerMonth: record.maxLateMarksPerMonth,
      lateDeductionPerMark: decimalToNumber(record.lateDeductionPerMark) ?? 0,
    },
  };
}

export function serializeEmployeeProfile(profile: {
  employeeCode: string | null;
  designation: string | null;
  joinDate: Date | null;
  confirmationDate: Date | null;
  employmentType: string;
  workLocation: string | null;
  probationEndDate: Date | null;
  fatherOrSpouseName: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  maritalStatus: string | null;
  nationality: string | null;
  bloodGroup: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  uanNumber: string | null;
  esicNumber: string | null;
  passportNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankAccountHolderName: string | null;
  ctc: Prisma.Decimal | null;
  basicSalary: Prisma.Decimal | null;
  hra: Prisma.Decimal | null;
  conveyanceAllowance: Prisma.Decimal | null;
  specialAllowance: Prisma.Decimal | null;
  baseSalary: Prisma.Decimal | null;
  payrollSettings: Prisma.JsonValue | null;
  leaveSettings: Prisma.JsonValue | null;
  lateMarkSettings: Prisma.JsonValue | null;
  user?: { department: string | null };
}) {
  return {
    employeeCode: profile.employeeCode,
    designation: profile.designation,
    department: profile.user?.department ?? null,
    joinDate: toDateString(profile.joinDate),
    confirmationDate: toDateString(profile.confirmationDate),
    employmentType: profile.employmentType,
    workLocation: profile.workLocation,
    probationEndDate: toDateString(profile.probationEndDate),
    fatherOrSpouseName: profile.fatherOrSpouseName,
    dateOfBirth: toDateString(profile.dateOfBirth),
    gender: profile.gender,
    maritalStatus: profile.maritalStatus,
    nationality: profile.nationality,
    bloodGroup: profile.bloodGroup,
    permanentAddress: profile.permanentAddress,
    currentAddress: profile.currentAddress,
    emergencyContactName: profile.emergencyContactName,
    emergencyContactPhone: profile.emergencyContactPhone,
    panNumber: profile.panNumber,
    aadhaarNumber: profile.aadhaarNumber,
    uanNumber: profile.uanNumber,
    esicNumber: profile.esicNumber,
    passportNumber: profile.passportNumber,
    bankName: profile.bankName,
    bankAccountNumber: profile.bankAccountNumber,
    bankIfsc: profile.bankIfsc,
    bankAccountHolderName: profile.bankAccountHolderName,
    ctc: decimalToNumber(profile.ctc),
    basicSalary: decimalToNumber(profile.basicSalary),
    hra: decimalToNumber(profile.hra),
    conveyanceAllowance: decimalToNumber(profile.conveyanceAllowance),
    specialAllowance: decimalToNumber(profile.specialAllowance),
    baseSalary: decimalToNumber(profile.baseSalary),
    payrollSettings: parseJsonField<PayrollSettings>(profile.payrollSettings, DEFAULT_PAYROLL_SETTINGS),
    leaveSettings: parseJsonField<LeaveSettings>(profile.leaveSettings, DEFAULT_LEAVE_SETTINGS),
    lateMarkSettings: parseJsonField<LateMarkSettings>(profile.lateMarkSettings, DEFAULT_LATE_MARK_SETTINGS),
  };
}

export function buildProfileCreateData(userId: string, data: McaEmployeeProfile & HrPolicyBundle) {
  return {
    userId,
    employeeCode: data.employeeCode,
    designation: data.designation,
    joinDate: data.joinDate ? new Date(data.joinDate) : new Date(),
    confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : undefined,
    employmentType: data.employmentType ?? "PERMANENT",
    workLocation: data.workLocation,
    probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : undefined,
    fatherOrSpouseName: data.fatherOrSpouseName,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
    gender: data.gender,
    maritalStatus: data.maritalStatus,
    nationality: data.nationality ?? "Indian",
    bloodGroup: data.bloodGroup,
    permanentAddress: data.permanentAddress,
    currentAddress: data.currentAddress,
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    panNumber: data.panNumber?.toUpperCase(),
    aadhaarNumber: data.aadhaarNumber,
    uanNumber: data.uanNumber,
    esicNumber: data.esicNumber,
    passportNumber: data.passportNumber,
    bankName: data.bankName,
    bankAccountNumber: data.bankAccountNumber,
    bankIfsc: data.bankIfsc?.toUpperCase(),
    bankAccountHolderName: data.bankAccountHolderName,
    ctc: data.ctc,
    basicSalary: data.basicSalary,
    hra: data.hra,
    conveyanceAllowance: data.conveyanceAllowance,
    specialAllowance: data.specialAllowance,
    baseSalary: data.baseSalary ?? data.basicSalary,
    payrollSettings: toInputJson(data.payroll),
    leaveSettings: toInputJson(data.leave),
    lateMarkSettings: toInputJson(data.lateMark),
  };
}

export function resolveLateMarkSettings(
  profile: { lateMarkSettings: Prisma.JsonValue | null } | null,
  orgPolicy: HrPolicyBundle
): LateMarkSettings {
  if (profile?.lateMarkSettings) {
    return parseJsonField(profile.lateMarkSettings, orgPolicy.lateMark);
  }
  return orgPolicy.lateMark;
}

export function computeLateStatus(
  punchIn: Date,
  settings: LateMarkSettings
): { lateMinutes: number; isLateMark: boolean; status: "PRESENT" | "HALF_DAY" } {
  const [h, m] = settings.officeStartTime.split(":").map(Number);
  const scheduled = new Date(punchIn);
  scheduled.setHours(h, m + settings.gracePeriodMins + settings.lateMarkAfterMins, 0, 0);

  if (punchIn <= scheduled) {
    return { lateMinutes: 0, isLateMark: false, status: "PRESENT" };
  }

  const lateMinutes = Math.floor((punchIn.getTime() - scheduled.getTime()) / 60000);
  const isLateMark = lateMinutes > 0;
  const status = lateMinutes >= settings.halfDayAfterMins ? "HALF_DAY" : "PRESENT";

  return { lateMinutes, isLateMark, status };
}

export async function ensureHrPolicySettings(prisma: Pick<PrismaClient, "hrPolicySettings">) {
  await prisma.hrPolicySettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      payCycleDay: DEFAULT_HR_POLICY.payroll.payCycleDay,
      pfEmployeePercent: DEFAULT_HR_POLICY.payroll.pfEmployeePercent,
      pfEmployerPercent: DEFAULT_HR_POLICY.payroll.pfEmployerPercent,
      esiEmployeePercent: DEFAULT_HR_POLICY.payroll.esiEmployeePercent,
      esiEmployerPercent: DEFAULT_HR_POLICY.payroll.esiEmployerPercent,
      professionalTax: DEFAULT_HR_POLICY.payroll.professionalTax,
      tdsApplicable: DEFAULT_HR_POLICY.payroll.tdsApplicable,
      casualLeaveDays: DEFAULT_HR_POLICY.leave.casualLeaveDays,
      sickLeaveDays: DEFAULT_HR_POLICY.leave.sickLeaveDays,
      earnedLeaveDays: DEFAULT_HR_POLICY.leave.earnedLeaveDays,
      carryForwardEnabled: DEFAULT_HR_POLICY.leave.carryForwardEnabled,
      maxCarryForwardDays: DEFAULT_HR_POLICY.leave.maxCarryForwardDays,
      officeStartTime: DEFAULT_HR_POLICY.lateMark.officeStartTime,
      officeEndTime: DEFAULT_HR_POLICY.lateMark.officeEndTime,
      gracePeriodMins: DEFAULT_HR_POLICY.lateMark.gracePeriodMins,
      lateMarkAfterMins: DEFAULT_HR_POLICY.lateMark.lateMarkAfterMins,
      halfDayAfterMins: DEFAULT_HR_POLICY.lateMark.halfDayAfterMins,
      maxLateMarksPerMonth: DEFAULT_HR_POLICY.lateMark.maxLateMarksPerMonth,
      lateDeductionPerMark: DEFAULT_HR_POLICY.lateMark.lateDeductionPerMark,
    },
    update: {},
  });
}

export async function initLeaveBalance(
  prisma: Pick<PrismaClient, "employeeLeaveBalance">,
  employeeProfileId: string,
  leaveSettings: LeaveSettings,
  year = new Date().getFullYear()
) {
  await prisma.employeeLeaveBalance.upsert({
    where: { employeeProfileId_year: { employeeProfileId, year } },
    create: {
      employeeProfileId,
      year,
      casualLeaveTotal: leaveSettings.casualLeaveDays,
      sickLeaveTotal: leaveSettings.sickLeaveDays,
      earnedLeaveTotal: leaveSettings.earnedLeaveDays,
    },
    update: {},
  });
}

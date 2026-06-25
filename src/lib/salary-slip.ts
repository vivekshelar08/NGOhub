import { DEFAULT_PAYROLL_SETTINGS, PayrollSettings } from "@/lib/hr-types";
import { Prisma } from "@/generated/prisma/client";
import { decimalToNumber } from "@/lib/hr-utils";
import { parseJsonField } from "@/lib/hr-profile";

export interface SalarySlipLine {
  label: string;
  amount: number;
}

export interface SalarySlipData {
  slipNumber: string;
  organizationName: string;
  payPeriod: { start: string; end: string };
  payDate: string;
  payrollStatus: string;
  employee: {
    name: string;
    email: string;
    employeeCode: string | null;
    designation: string | null;
    department: string | null;
    panNumber: string | null;
    uanNumber: string | null;
    esicNumber: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
  };
  earnings: SalarySlipLine[];
  deductions: SalarySlipLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  attendanceSummary: {
    presentDays: number;
    lateMarks: number;
    leaveDays: number;
    halfDays: number;
  };
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export { formatINR };

export function resolvePayrollSettings(
  profileSettings: Prisma.JsonValue | null,
  orgPolicy?: PayrollSettings
): PayrollSettings {
  return parseJsonField(profileSettings, orgPolicy ?? DEFAULT_PAYROLL_SETTINGS);
}

export function computePayrollAmounts(input: {
  basicSalary: number;
  hra: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  bonuses: number;
  payrollSettings: PayrollSettings;
  lateMarkCount: number;
  lateDeductionPerMark: number;
  extraDeductions?: number;
}) {
  const {
    basicSalary,
    hra,
    conveyanceAllowance,
    specialAllowance,
    bonuses,
    payrollSettings,
    lateMarkCount,
    lateDeductionPerMark,
    extraDeductions = 0,
  } = input;

  const pf = Math.round((basicSalary * payrollSettings.pfEmployeePercent) / 100);
  const grossBeforeBonus = basicSalary + hra + conveyanceAllowance + specialAllowance;
  const grossPay = grossBeforeBonus + bonuses;
  const esi = Math.round((grossBeforeBonus * payrollSettings.esiEmployeePercent) / 100);
  const professionalTax = payrollSettings.professionalTax;
  const lateDeduction = lateMarkCount * lateDeductionPerMark;
  const tds = payrollSettings.tdsApplicable ? Math.round(grossPay * 0.1) : 0;

  const statutoryDeductions = pf + esi + professionalTax + lateDeduction + tds;
  const totalDeductions = statutoryDeductions + extraDeductions;
  const netPay = Math.max(0, grossPay - totalDeductions);

  const earnings: SalarySlipLine[] = [
    { label: "Basic Salary", amount: basicSalary },
    ...(hra > 0 ? [{ label: "HRA", amount: hra }] : []),
    ...(conveyanceAllowance > 0 ? [{ label: "Conveyance Allowance", amount: conveyanceAllowance }] : []),
    ...(specialAllowance > 0 ? [{ label: "Special Allowance", amount: specialAllowance }] : []),
    ...(bonuses > 0 ? [{ label: "Bonus / Incentives", amount: bonuses }] : []),
  ].filter((e) => e.amount > 0);

  const deductions: SalarySlipLine[] = [
    ...(pf > 0 ? [{ label: `PF (${payrollSettings.pfEmployeePercent}%)`, amount: pf }] : []),
    ...(esi > 0 ? [{ label: `ESI (${payrollSettings.esiEmployeePercent}%)`, amount: esi }] : []),
    ...(professionalTax > 0 ? [{ label: "Professional Tax", amount: professionalTax }] : []),
    ...(lateDeduction > 0 ? [{ label: `Late Mark (${lateMarkCount}×)`, amount: lateDeduction }] : []),
    ...(tds > 0 ? [{ label: "TDS", amount: tds }] : []),
    ...(extraDeductions > 0 ? [{ label: "Other Deductions", amount: extraDeductions }] : []),
  ];

  return { earnings, deductions, grossPay, totalDeductions, netPay };
}

export function buildSalarySlipData(input: {
  lineId: string;
  payrollRun: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    status: string;
    createdAt: Date;
  };
  user: {
    name: string;
    email: string;
    department: string | null;
  };
  employeeProfile: {
    employeeCode: string | null;
    designation: string | null;
    panNumber: string | null;
    uanNumber: string | null;
    esicNumber: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankIfsc: string | null;
    basicSalary: Prisma.Decimal | null;
    hra: Prisma.Decimal | null;
    conveyanceAllowance: Prisma.Decimal | null;
    specialAllowance: Prisma.Decimal | null;
    baseSalary: Prisma.Decimal | null;
    payrollSettings: Prisma.JsonValue | null;
    lateMarkSettings: Prisma.JsonValue | null;
  } | null;
  payrollLine: {
    baseSalary: Prisma.Decimal;
    deductions: Prisma.Decimal;
    bonuses: Prisma.Decimal;
    netPay: Prisma.Decimal;
  };
  orgPayrollSettings: PayrollSettings;
  attendanceRecords: Array<{ status: string; isLateMark: boolean }>;
  organizationName?: string;
}): SalarySlipData {
  const profile = input.employeeProfile;
  const payrollSettings = resolvePayrollSettings(profile?.payrollSettings ?? null, input.orgPayrollSettings);

  const basicSalary =
    decimalToNumber(profile?.basicSalary) ??
    decimalToNumber(profile?.baseSalary) ??
    decimalToNumber(input.payrollLine.baseSalary) ??
    0;
  const hra = decimalToNumber(profile?.hra) ?? 0;
  const conveyanceAllowance = decimalToNumber(profile?.conveyanceAllowance) ?? 0;
  const specialAllowance = decimalToNumber(profile?.specialAllowance) ?? 0;
  const bonuses = decimalToNumber(input.payrollLine.bonuses) ?? 0;

  const lateMarkCount = input.attendanceRecords.filter((r) => r.isLateMark).length;
  const lateSettings = parseJsonField(profile?.lateMarkSettings, {
    lateDeductionPerMark: 0,
    maxLateMarksPerMonth: 3,
  });

  const storedDeductions = decimalToNumber(input.payrollLine.deductions) ?? 0;
  const computed = computePayrollAmounts({
    basicSalary,
    hra,
    conveyanceAllowance,
    specialAllowance,
    bonuses,
    payrollSettings,
    lateMarkCount,
    lateDeductionPerMark: lateSettings.lateDeductionPerMark ?? 0,
  });

  const presentDays = input.attendanceRecords.filter((r) => r.status === "PRESENT").length;
  const halfDays = input.attendanceRecords.filter((r) => r.status === "HALF_DAY").length;
  const leaveDays = input.attendanceRecords.filter((r) => r.status === "LEAVE").length;

  const periodStart = input.payrollRun.periodStart.toISOString().slice(0, 10);
  const periodEnd = input.payrollRun.periodEnd.toISOString().slice(0, 10);

  return {
    slipNumber: `SLIP-${input.payrollRun.id.slice(0, 8).toUpperCase()}-${input.lineId.slice(0, 6).toUpperCase()}`,
    organizationName: input.organizationName ?? "NGO Hub",
    payPeriod: { start: periodStart, end: periodEnd },
    payDate: input.payrollRun.createdAt.toISOString().slice(0, 10),
    payrollStatus: input.payrollRun.status,
    employee: {
      name: input.user.name,
      email: input.user.email,
      employeeCode: profile?.employeeCode ?? null,
      designation: profile?.designation ?? null,
      department: input.user.department,
      panNumber: profile?.panNumber ?? null,
      uanNumber: profile?.uanNumber ?? null,
      esicNumber: profile?.esicNumber ?? null,
      bankName: profile?.bankName ?? null,
      bankAccountNumber: profile?.bankAccountNumber ?? null,
      bankIfsc: profile?.bankIfsc ?? null,
    },
    earnings: computed.earnings,
    deductions: computed.deductions.length > 0 ? computed.deductions : storedDeductions > 0
      ? [{ label: "Total Deductions", amount: storedDeductions }]
      : [],
    grossPay: computed.grossPay,
    totalDeductions: computed.totalDeductions > 0 ? computed.totalDeductions : storedDeductions,
    netPay: computed.netPay > 0 ? computed.netPay : (decimalToNumber(input.payrollLine.netPay) ?? 0),
    attendanceSummary: {
      presentDays,
      lateMarks: lateMarkCount,
      leaveDays,
      halfDays,
    },
  };
}

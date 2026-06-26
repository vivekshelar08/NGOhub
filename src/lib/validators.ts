import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "HR", "COORDINATOR", "STAFF"]),
  phone: z.string().optional(),
  department: z.string().optional(),
});

export const payrollSettingsSchema = z.object({
  payCycleDay: z.number().int().min(1).max(28).default(1),
  pfEmployeePercent: z.number().min(0).max(100).default(12),
  pfEmployerPercent: z.number().min(0).max(100).default(12),
  esiEmployeePercent: z.number().min(0).max(100).default(0.75),
  esiEmployerPercent: z.number().min(0).max(100).default(3.25),
  professionalTax: z.number().nonnegative().default(200),
  tdsApplicable: z.boolean().default(false),
});

export const leaveSettingsSchema = z.object({
  casualLeaveDays: z.number().int().min(0).default(12),
  sickLeaveDays: z.number().int().min(0).default(10),
  earnedLeaveDays: z.number().int().min(0).default(15),
  carryForwardEnabled: z.boolean().default(true),
  maxCarryForwardDays: z.number().int().min(0).default(30),
});

export const lateMarkSettingsSchema = z.object({
  officeStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  officeEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  gracePeriodMins: z.number().int().min(0).default(15),
  lateMarkAfterMins: z.number().int().min(0).default(15),
  halfDayAfterMins: z.number().int().min(0).default(120),
  maxLateMarksPerMonth: z.number().int().min(0).default(3),
  lateDeductionPerMark: z.number().nonnegative().default(0),
});

export const hrPolicySchema = z.object({
  payroll: payrollSettingsSchema,
  leave: leaveSettingsSchema,
  lateMark: lateMarkSettingsSchema,
});

export const mcaProfileSchema = z.object({
  employeeCode: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  joinDate: z.string().optional(),
  confirmationDate: z.string().optional(),
  employmentType: z.enum(["PERMANENT", "CONTRACT", "PROBATION", "INTERN"]).optional(),
  workLocation: z.string().optional(),
  probationEndDate: z.string().optional(),
  fatherOrSpouseName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional(),
  nationality: z.string().optional(),
  bloodGroup: z.string().optional(),
  permanentAddress: z.string().optional(),
  currentAddress: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  panNumber: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  uanNumber: z.string().optional(),
  esicNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankAccountHolderName: z.string().optional(),
  ctc: z.number().nonnegative().optional(),
  basicSalary: z.number().nonnegative().optional(),
  hra: z.number().nonnegative().optional(),
  conveyanceAllowance: z.number().nonnegative().optional(),
  specialAllowance: z.number().nonnegative().optional(),
  baseSalary: z.number().nonnegative().optional(),
});

export const employeeProfileSchema = mcaProfileSchema.extend({
  userId: z.string().uuid(),
  payroll: payrollSettingsSchema.optional(),
  leave: leaveSettingsSchema.optional(),
  lateMark: lateMarkSettingsSchema.optional(),
});

export const updateEmployeeProfileSchema = employeeProfileSchema.partial().omit({ userId: true });

export const punchSchema = z.object({
  action: z.enum(["in", "out"]),
});

export const payrollRunSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  notes: z.string().optional(),
});

export const performanceReviewSchema = z.object({
  userId: z.string().uuid(),
  period: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional(),
});

export const enrollmentInviteSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "ACCOUNTANT", "HR", "COORDINATOR", "STAFF"]).default("STAFF"),
  department: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
  payroll: payrollSettingsSchema.optional(),
  leave: leaveSettingsSchema.optional(),
  lateMark: lateMarkSettingsSchema.optional(),
  employeePreset: mcaProfileSchema.optional(),
});

export const enrollCompleteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().optional(),
  profile: mcaProfileSchema,
});

export const leaveApplicationSchema = z.object({
  leaveType: z.enum(["CL", "SL", "EL"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export const leaveActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const serviceSchema = z.object({
  name: z.string().min(2, "Service name is required"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const serviceStepSchema = z.object({
  name: z.string().min(1, "Step name is required"),
  description: z.string().optional(),
  stepOrder: z.number().int().positive(),
});

export const beneficiarySchema = z.object({
  name: z.string().min(2, "Name is required"),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.string().optional(),
  mobile: z.string().optional(),
  alternateMobile: z.string().optional(),
  idDocumentType: z.enum(["AADHAAR", "VOTER_ID", "RATION_CARD", "PAN", "OTHER"]).optional(),
  idDocumentNumber: z.string().optional(),
  pincode: z.string().optional(),
  address: z.string().optional(),
  category: z.enum(["GENERAL", "SC", "ST", "OBC", "EWS", "OTHER"]).default("GENERAL"),
  cohorts: z
    .array(
      z.enum([
        "PWD",
        "MIGRANT",
        "SINGLE_MOTHER",
        "SANITATION_WORKER",
        "MINORITY",
        "SENIOR_CITIZEN",
        "TRANSGENDER",
        "WIDOW",
        "ORPHAN",
        "TRIBAL",
        "OTHER",
      ])
    )
    .default([]),
  monthlyIncome: z.number().nonnegative().optional(),
  familyMembers: z.number().int().positive().optional(),
  location: z.string().optional(),
  isUrgentCase: z.boolean().default(false),
  isCaseStudy: z.boolean().default(false),
  notes: z.string().optional(),
  projectId: z.string().min(1, "Select a project"),
  serviceId: z.string().uuid("Select a service").optional(),
});

export const updateBeneficiarySchema = beneficiarySchema
  .partial()
  .omit({ serviceId: true })
  .extend({
    isRemoved: z.boolean().optional(),
    removedAt: z.string().optional(),
  });

export const serviceDeliveryStatusSchema = z.object({
  status: z.enum(["DATA_ENTERED", "IN_PROGRESS", "REJECTED", "COMPLETED"]),
  notes: z.string().optional(),
});

export const deliveryActionSchema = z.object({
  action: z.enum(["approve", "advance_step", "objection", "clear_objection", "reject"]),
  note: z.string().optional(),
  resolutionNote: z.string().optional(),
});

export const followUpSchema = z.object({
  note: z.string().min(1, "Follow-up note is required"),
  deliveryId: z.string().uuid().optional(),
});

export const addServiceToBeneficiarySchema = z.object({
  serviceId: z.string().uuid(),
  notes: z.string().optional(),
});

export const activityRequestSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  workType: z.enum(["OFFICE", "PROJECT", "WORKSHOP", "OTHER"]).default("PROJECT"),
  scheduledDate: z.string(),
  endDate: z.string().optional(),
  projectId: z.string().optional(),
});

export const activityRequestActionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  reviewNotes: z.string().optional(),
});

const expenseAttachmentSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1),
});

export const expenseSchema = z.object({
  category: z.enum(["TRAVEL", "CAMP", "STATIONERY", "OTHER"]),
  paymentType: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"]),
  amount: z.number().positive("Amount must be greater than zero"),
  expenseDate: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  conveyanceFrom: z.string().optional(),
  conveyanceTo: z.string().optional(),
  conveyanceKm: z.number().nonnegative().optional(),
  projectId: z.string().optional(),
  budgetHead: z.string().optional(),
  fundType: z.string().optional(),
  fundId: z.string().optional(),
  financeProjectId: z.string().optional(),
  attachments: z.array(expenseAttachmentSchema).min(1, "At least one bill photo or PDF is required"),
});

export const expenseActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().optional(),
});

const surveyQuestionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const surveyQuestionValidationSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().optional(),
    scaleMin: z.number().int().optional(),
    scaleMax: z.number().int().optional(),
    scaleMinLabel: z.string().optional(),
    scaleMaxLabel: z.string().optional(),
    ratingMax: z.number().int().min(3).max(10).optional(),
  })
  .optional();

export const surveyQuestionSchema = z.object({
  order: z.number().int().positive(),
  type: z.enum([
    "TEXT_SHORT",
    "TEXT_LONG",
    "NUMBER",
    "DATE",
    "SINGLE_CHOICE",
    "MULTI_CHOICE",
    "DROPDOWN",
    "RATING",
    "LINEAR_SCALE",
    "YES_NO",
    "EMAIL",
    "PHONE",
    "FILE_UPLOAD",
  ]),
  label: z.string().min(1, "Question label is required"),
  description: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(surveyQuestionOptionSchema).nullish(),
  validation: surveyQuestionValidationSchema.nullish(),
});

export const surveySchema = z.object({
  title: z.string().min(2, "Survey title is required"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  allowMultipleResponses: z.boolean().default(false),
  isAnonymous: z.boolean().default(false),
  showProgressBar: z.boolean().default(true),
  randomizeQuestions: z.boolean().default(false),
  dueDate: z.string().optional(),
  questions: z.array(surveyQuestionSchema).min(1, "Add at least one question"),
});

export const updateSurveySchema = surveySchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional(),
});

export const surveyActionSchema = z.object({
  action: z.enum(["publish", "close", "archive", "reopen"]),
});

export const surveyAnswerSchema = z.object({
  questionId: z.string().uuid(),
  value: z.unknown(),
});

export const surveyResponseSchema = z.object({
  surveyId: z.string().uuid(),
  answers: z.array(surveyAnswerSchema).min(1, "Provide at least one answer"),
  submit: z.boolean().default(true),
});

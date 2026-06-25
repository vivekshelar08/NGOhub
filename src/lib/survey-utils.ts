import { parseDateOnly } from "@/lib/hr-utils";

export const SURVEY_QUESTION_TYPES = [
  { value: "TEXT_SHORT", label: "Short text", group: "Text" },
  { value: "TEXT_LONG", label: "Long text", group: "Text" },
  { value: "EMAIL", label: "Email", group: "Text" },
  { value: "PHONE", label: "Phone", group: "Text" },
  { value: "NUMBER", label: "Number", group: "Numeric" },
  { value: "DATE", label: "Date", group: "Numeric" },
  { value: "RATING", label: "Star rating", group: "Scale" },
  { value: "LINEAR_SCALE", label: "Linear scale (1–10)", group: "Scale" },
  { value: "YES_NO", label: "Yes / No", group: "Choice" },
  { value: "SINGLE_CHOICE", label: "Single choice", group: "Choice" },
  { value: "MULTI_CHOICE", label: "Multiple choice", group: "Choice" },
  { value: "DROPDOWN", label: "Dropdown", group: "Choice" },
  { value: "FILE_UPLOAD", label: "File upload", group: "Media" },
] as const;

export type SurveyQuestionTypeValue = (typeof SURVEY_QUESTION_TYPES)[number]["value"];

export interface SurveyQuestionOption {
  value: string;
  label: string;
}

export interface SurveyQuestionValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  ratingMax?: number;
}

export interface SerializedSurveyQuestion {
  id: string;
  order: number;
  type: string;
  label: string;
  description: string | null;
  required: boolean;
  options: SurveyQuestionOption[] | null;
  validation: SurveyQuestionValidation | null;
}

export interface SerializedSurvey {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectId: string | null;
  allowMultipleResponses: boolean;
  isAnonymous: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  dueDate: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; department: string | null };
  questionCount: number;
  responseCount: number;
  myResponseCount?: number;
  questions?: SerializedSurveyQuestion[];
}

export interface SerializedSurveyAnswer {
  id: string;
  questionId: string;
  value: unknown;
}

export interface SerializedSurveyResponse {
  id: string;
  surveyId: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  submittedBy: { id: string; name: string; department: string | null } | null;
  answers: SerializedSurveyAnswer[];
}

export function parseSurveyDueDate(value?: string | null): Date | null {
  if (!value) return null;
  return parseDateOnly(value);
}

export function choiceTypes(): Set<string> {
  return new Set(["SINGLE_CHOICE", "MULTI_CHOICE", "DROPDOWN", "YES_NO"]);
}

export function validateAnswerValue(
  type: string,
  value: unknown,
  required: boolean,
  validation: SurveyQuestionValidation | null,
  options: SurveyQuestionOption[] | null
): string | null {
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (empty) {
    return required ? "This question is required" : null;
  }

  switch (type) {
    case "TEXT_SHORT":
    case "TEXT_LONG": {
      if (typeof value !== "string") return "Invalid text answer";
      if (validation?.minLength && value.length < validation.minLength) {
        return `Minimum ${validation.minLength} characters required`;
      }
      if (validation?.maxLength && value.length > validation.maxLength) {
        return `Maximum ${validation.maxLength} characters allowed`;
      }
      return null;
    }
    case "EMAIL": {
      if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Enter a valid email address";
      }
      return null;
    }
    case "PHONE": {
      if (typeof value !== "string" || value.replace(/\D/g, "").length < 10) {
        return "Enter a valid phone number";
      }
      return null;
    }
    case "NUMBER":
    case "RATING":
    case "LINEAR_SCALE": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return "Enter a valid number";
      const min =
        validation?.min ??
        validation?.scaleMin ??
        (type === "RATING" ? 1 : type === "LINEAR_SCALE" ? 1 : undefined);
      const max =
        validation?.max ??
        validation?.scaleMax ??
        validation?.ratingMax ??
        (type === "RATING" ? 5 : type === "LINEAR_SCALE" ? 10 : undefined);
      if (min !== undefined && num < min) return `Minimum value is ${min}`;
      if (max !== undefined && num > max) return `Maximum value is ${max}`;
      return null;
    }
    case "DATE": {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "Enter a valid date";
      }
      return null;
    }
    case "YES_NO": {
      if (value !== "yes" && value !== "no") return "Select yes or no";
      return null;
    }
    case "SINGLE_CHOICE":
    case "DROPDOWN": {
      if (typeof value !== "string") return "Select an option";
      if (options?.length && !options.some((o) => o.value === value)) {
        return "Invalid option selected";
      }
      return null;
    }
    case "MULTI_CHOICE": {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        return "Select one or more options";
      }
      if (options?.length) {
        const allowed = new Set(options.map((o) => o.value));
        if (!value.every((v) => allowed.has(v))) return "Invalid option selected";
      }
      return null;
    }
    case "FILE_UPLOAD": {
      if (
        typeof value !== "object" ||
        value === null ||
        !("fileName" in value) ||
        !("dataUrl" in value)
      ) {
        return "Upload a file";
      }
      return null;
    }
    default:
      return null;
  }
}

export function defaultValidationForType(type: string): SurveyQuestionValidation | null {
  switch (type) {
    case "RATING":
      return { ratingMax: 5 };
    case "LINEAR_SCALE":
      return { scaleMin: 1, scaleMax: 10, scaleMinLabel: "Low", scaleMaxLabel: "High" };
    case "NUMBER":
      return { min: 0 };
    default:
      return null;
  }
}

export function defaultOptionsForType(type: string): SurveyQuestionOption[] | null {
  if (type === "YES_NO") {
    return [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];
  }
  if (choiceTypes().has(type) && type !== "YES_NO") {
    return [
      { value: "option_1", label: "Option 1" },
      { value: "option_2", label: "Option 2" },
    ];
  }
  return null;
}

/** Strip null JSON fields and empty strings before API submission. */
export function buildSurveyPayload(input: {
  title: string;
  description: string;
  projectId: string;
  dueDate: string;
  allowMultipleResponses: boolean;
  isAnonymous: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  questions: Array<{
    order: number;
    type: string;
    label: string;
    description: string;
    required: boolean;
    options: SurveyQuestionOption[] | null;
    validation: SurveyQuestionValidation | null;
  }>;
}) {
  return {
    title: input.title.trim(),
    description: input.description.trim() || undefined,
    projectId: input.projectId || undefined,
    dueDate: input.dueDate || undefined,
    allowMultipleResponses: input.allowMultipleResponses,
    isAnonymous: input.isAnonymous,
    showProgressBar: input.showProgressBar,
    randomizeQuestions: input.randomizeQuestions,
    questions: input.questions.map((q, index) => {
      const question: Record<string, unknown> = {
        order: index + 1,
        type: q.type,
        label: q.label.trim(),
        required: q.required,
      };
      const description = q.description.trim();
      if (description) question.description = description;
      if (q.options?.length) question.options = q.options;
      if (q.validation) question.validation = q.validation;
      return question;
    }),
  };
}

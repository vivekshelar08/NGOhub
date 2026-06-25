"use client";

import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import type { SerializedSurveyQuestion } from "@/lib/survey-utils";

interface QuestionFieldProps {
  question: SerializedSurveyQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

function StarRating({
  max,
  value,
  onChange,
  disabled,
}: {
  max: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`text-2xl transition-colors ${
            star <= value ? "text-amber-400" : "text-slate-300 hover:text-amber-200"
          }`}
          aria-label={`Rate ${star} of ${max}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function QuestionField({ question, value, onChange, disabled }: QuestionFieldProps) {
  const options = question.options ?? [];
  const validation = question.validation ?? {};
  const ratingMax = validation.ratingMax ?? 5;
  const scaleMin = validation.scaleMin ?? 1;
  const scaleMax = validation.scaleMax ?? 10;

  return (
    <div className="space-y-2">
      <div>
        <Label>
          {question.label}
          {question.required && <span className="text-brand-red"> *</span>}
        </Label>
        {question.description && (
          <p className="mt-0.5 text-sm text-slate-500">{question.description}</p>
        )}
      </div>

      {(question.type === "TEXT_SHORT" || question.type === "EMAIL" || question.type === "PHONE") && (
        <Input
          type={question.type === "EMAIL" ? "email" : question.type === "PHONE" ? "tel" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={question.type === "EMAIL" ? "name@example.com" : undefined}
        />
      )}

      {question.type === "TEXT_LONG" && (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {question.type === "NUMBER" && (
        <Input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          min={validation.min}
          max={validation.max}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          disabled={disabled}
        />
      )}

      {question.type === "DATE" && (
        <Input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {question.type === "RATING" && (
        <StarRating
          max={ratingMax}
          value={typeof value === "number" ? value : 0}
          onChange={onChange}
          disabled={disabled}
        />
      )}

      {question.type === "LINEAR_SCALE" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{validation.scaleMinLabel ?? scaleMin}</span>
            <span>{validation.scaleMaxLabel ?? scaleMax}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i).map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-lg border text-sm font-semibold transition-colors ${
                  value === n
                    ? "border-brand-teal bg-brand-teal text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-teal/50"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {question.type === "YES_NO" && (
        <div className="flex gap-3">
          {options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={question.id}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                disabled={disabled}
                className="h-4 w-4 accent-brand-teal"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {(question.type === "SINGLE_CHOICE" || question.type === "DROPDOWN") &&
        (question.type === "DROPDOWN" ? (
          <Select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            <option value="">Select an option</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : (
          <div className="space-y-2">
            {options.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name={question.id}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  disabled={disabled}
                  className="h-4 w-4 accent-brand-teal"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        ))}

      {question.type === "MULTI_CHOICE" && (
        <div className="space-y-2">
          {options.map((opt) => {
            const selected = Array.isArray(value) ? (value as string[]) : [];
            const checked = selected.includes(opt.value);
            return (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    if (checked) onChange(selected.filter((v) => v !== opt.value));
                    else onChange([...selected, opt.value]);
                  }}
                  disabled={disabled}
                  className="h-4 w-4 accent-brand-teal"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === "FILE_UPLOAD" && (
        <div>
          <Input
            type="file"
            accept="image/*,.pdf"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                onChange({
                  fileName: file.name,
                  mimeType: file.type,
                  dataUrl: reader.result,
                });
              };
              reader.readAsDataURL(file);
            }}
          />
          {typeof value === "object" &&
            value !== null &&
            "fileName" in value && (
              <p className="mt-1 text-xs text-emerald-600">
                Uploaded: {(value as { fileName: string }).fileName}
              </p>
            )}
        </div>
      )}
    </div>
  );
}

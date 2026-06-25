"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { QuestionField } from "@/components/surveys/QuestionField";
import type { SerializedSurvey, SerializedSurveyQuestion } from "@/lib/survey-utils";
import { cn } from "@/lib/utils";
import { CheckCircle2, ClipboardList } from "lucide-react";

interface SurveyFillPanelProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function SurveyFillPanel({ onSuccess, onError }: SurveyFillPanelProps) {
  const [surveys, setSurveys] = useState<SerializedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<SerializedSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  async function loadSurveys() {
    setLoading(true);
    try {
      const res = await fetch("/api/surveys?mode=fill");
      const data = await res.json();
      if (res.ok) setSurveys(data.surveys ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSurveys();
  }, []);

  async function openSurvey(id: string) {
    const res = await fetch(`/api/surveys/${id}`);
    const data = await res.json();
    if (!res.ok) {
      onError(data.error ?? "Failed to load survey");
      return;
    }
    let questions = (data.survey.questions ?? []) as SerializedSurveyQuestion[];
    if (data.survey.randomizeQuestions) {
      questions = [...questions].sort(() => Math.random() - 0.5);
    }
    setActiveSurvey({ ...data.survey, questions });
    setAnswers({});
    setStep(0);
  }

  const questions = activeSurvey?.questions ?? [];
  const useSteps = questions.length > 5;
  const visibleQuestions = useSteps ? questions.slice(step, step + 1) : questions;
  const progress = questions.length ? Math.round(((useSteps ? step + 1 : questions.length) / questions.length) * 100) : 0;

  const canSubmit = useMemo(() => {
    if (!activeSurvey) return false;
    if (useSteps && step < questions.length - 1) return false;
    return true;
  }, [activeSurvey, useSteps, step, questions.length]);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function submitResponse() {
    if (!activeSurvey) return;
    setSubmitting(true);
    try {
      const payload = {
        surveyId: activeSurvey.id,
        submit: true,
        answers: questions.map((q) => ({
          questionId: q.id,
          value: answers[q.id] ?? (q.type === "MULTI_CHOICE" ? [] : ""),
        })),
      };

      const res = await fetch("/api/survey-responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Submission failed");
        return;
      }
      onSuccess("Survey submitted successfully");
      setActiveSurvey(null);
      await loadSurveys();
    } finally {
      setSubmitting(false);
    }
  }

  if (activeSurvey) {
    return (
      <Card accent>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <CardTitle>{activeSurvey.title}</CardTitle>
            {activeSurvey.description && <CardDescription>{activeSurvey.description}</CardDescription>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActiveSurvey(null)}>
            Back
          </Button>
        </div>

        {activeSurvey.showProgressBar && (
          <div className="mb-6">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-teal transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-6">
          {visibleQuestions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {useSteps && step > 0 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Previous
            </Button>
          )}
          {useSteps && step < questions.length - 1 && (
            <Button variant="teal" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          )}
          {canSubmit && (
            <Button onClick={submitResponse} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit survey"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading available surveys…</p>
      ) : surveys.length === 0 ? (
        <Card className="text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No published surveys available right now.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {surveys.map((s) => {
            const alreadySubmitted = !s.allowMultipleResponses && (s.myResponseCount ?? 0) > 0;
            return (
              <Card key={s.id} className={cn(alreadySubmitted && "opacity-75")}>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  {alreadySubmitted && (
                    <StatusBadge tone="success" className="shrink-0">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      Done
                    </StatusBadge>
                  )}
                </div>
                {s.description && <CardDescription>{s.description}</CardDescription>}
                <p className="mt-3 text-xs text-slate-400">
                  {s.questionCount} questions
                  {s.dueDate ? ` · Due ${s.dueDate}` : ""}
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  disabled={alreadySubmitted}
                  onClick={() => openSurvey(s.id)}
                >
                  {alreadySubmitted ? "Already submitted" : "Start survey"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

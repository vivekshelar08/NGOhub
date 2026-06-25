"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { loadProjects } from "@/lib/projects";
import {
  SURVEY_QUESTION_TYPES,
  defaultOptionsForType,
  defaultValidationForType,
  buildSurveyPayload,
  type SerializedSurvey,
  type SurveyQuestionOption,
  type SurveyQuestionValidation,
} from "@/lib/survey-utils";
import { cn } from "@/lib/utils";
import { GripVertical, Plus, Trash2 } from "lucide-react";

interface DraftQuestion {
  order: number;
  type: string;
  label: string;
  description: string;
  required: boolean;
  options: SurveyQuestionOption[] | null;
  validation: SurveyQuestionValidation | null;
}

interface SurveyBuilderPanelProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onSaved: () => void;
}

const emptyQuestion = (order: number): DraftQuestion => ({
  order,
  type: "TEXT_SHORT",
  label: "",
  description: "",
  required: false,
  options: null,
  validation: null,
});

export function SurveyBuilderPanel({ onSuccess, onError, onSaved }: SurveyBuilderPanelProps) {
  const [surveys, setSurveys] = useState<SerializedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion(1)]);

  const projects = loadProjects().filter((p) => p.status === "APPROVED");

  async function loadSurveys() {
    setLoading(true);
    try {
      const res = await fetch("/api/surveys?mode=manage");
      const data = await res.json();
      if (res.ok) setSurveys(data.surveys ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSurveys();
  }, []);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setProjectId("");
    setDueDate("");
    setAllowMultipleResponses(false);
    setIsAnonymous(false);
    setShowProgressBar(true);
    setRandomizeQuestions(false);
    setQuestions([emptyQuestion(1)]);
    setShowForm(false);
  }

  async function loadForEdit(id: string) {
    const res = await fetch(`/api/surveys/${id}`);
    const data = await res.json();
    if (!res.ok) {
      onError(data.error ?? "Failed to load survey");
      return;
    }
    const s = data.survey;
    setEditingId(s.id);
    setTitle(s.title);
    setDescription(s.description ?? "");
    setProjectId(s.projectId ?? "");
    setDueDate(s.dueDate ?? "");
    setAllowMultipleResponses(s.allowMultipleResponses);
    setIsAnonymous(s.isAnonymous);
    setShowProgressBar(s.showProgressBar);
    setRandomizeQuestions(s.randomizeQuestions);
    setQuestions(
      (s.questions ?? []).map(
        (q: {
          order: number;
          type: string;
          label: string;
          description: string | null;
          required: boolean;
          options: SurveyQuestionOption[] | null;
          validation: SurveyQuestionValidation | null;
        }) => ({
          order: q.order,
          type: q.type,
          label: q.label,
          description: q.description ?? "",
          required: q.required,
          options: q.options,
          validation: q.validation,
        })
      )
    );
    setShowForm(true);
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        const next = { ...q, ...patch };
        if (patch.type && patch.type !== q.type) {
          next.options = defaultOptionsForType(patch.type);
          next.validation = defaultValidationForType(patch.type);
        }
        return next;
      })
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion(prev.length + 1)]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) =>
      prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 }))
    );
  }

  async function saveSurvey() {
    const emptyLabels = questions.filter((q) => !q.label.trim());
    if (!title.trim()) {
      onError("Survey title is required");
      return;
    }
    if (emptyLabels.length > 0) {
      onError("Every question needs a label before saving");
      return;
    }

    setSaving(true);
    try {
      const payload = buildSurveyPayload({
        title,
        description,
        projectId,
        dueDate,
        allowMultipleResponses,
        isAnonymous,
        showProgressBar,
        randomizeQuestions,
        questions,
      });

      const res = await fetch(editingId ? `/api/surveys/${editingId}` : "/api/surveys", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Failed to save survey");
        return;
      }
      onSuccess(editingId ? "Survey updated" : "Survey saved as draft");
      resetForm();
      await loadSurveys();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function runAction(id: string, action: string) {
    const res = await fetch(`/api/surveys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error ?? "Action failed");
      return;
    }
    onSuccess(`Survey ${action}d`);
    await loadSurveys();
    onSaved();
  }

  async function deleteSurvey(id: string) {
    if (!confirm("Delete this survey and all responses?")) return;
    const res = await fetch(`/api/surveys/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      onError(data.error ?? "Delete failed");
      return;
    }
    onSuccess("Survey deleted");
    await loadSurveys();
    onSaved();
  }

  const statusColor: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    PUBLISHED: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-amber-100 text-amber-700",
    ARCHIVED: "bg-slate-100 text-slate-500",
  };

  return (
    <div className="space-y-6">
      {!showForm && (
        <div className="flex justify-end">
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Survey
          </Button>
        </div>
      )}

      {showForm && (
        <Card accent>
          <CardTitle>{editingId ? "Edit Survey" : "Create Survey"}</CardTitle>
          <CardDescription>
            Design questions with multiple types — text, numbers, dates, ratings, choices, and file uploads.
          </CardDescription>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Survey title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Field visit feedback" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions for respondents" />
            </div>
            <div>
              <Label>Link to project (optional)</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Due date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowMultipleResponses} onChange={(e) => setAllowMultipleResponses(e.target.checked)} />
              Allow multiple submissions
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
              Anonymous responses
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showProgressBar} onChange={(e) => setShowProgressBar(e.target.checked)} />
              Show progress bar
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={randomizeQuestions} onChange={(e) => setRandomizeQuestions(e.target.checked)} />
              Randomize question order
            </label>
          </div>

          <div className="mt-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Questions</h3>
            {questions.map((q, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-400">Q{index + 1}</span>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(index)} className="ml-auto text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Question type</Label>
                    <Select value={q.type} onChange={(e) => updateQuestion(index, { type: e.target.value })}>
                      {Array.from(new Set(SURVEY_QUESTION_TYPES.map((t) => t.group))).map((group) => (
                        <optgroup key={group} label={group}>
                          {SURVEY_QUESTION_TYPES.filter((t) => t.group === group).map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => updateQuestion(index, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Question label</Label>
                    <Input value={q.label} onChange={(e) => updateQuestion(index, { label: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Help text (optional)</Label>
                    <Input value={q.description} onChange={(e) => updateQuestion(index, { description: e.target.value })} />
                  </div>
                </div>

                {q.options && (
                  <div className="mt-3 space-y-2">
                    <Label>Options</Label>
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex gap-2">
                        <Input
                          value={opt.label}
                          onChange={(e) => {
                            const next = [...q.options!];
                            next[optIndex] = {
                              value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                              label: e.target.value,
                            };
                            updateQuestion(index, { options: next });
                          }}
                          placeholder={`Option ${optIndex + 1}`}
                        />
                        {q.options!.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateQuestion(index, {
                                options: q.options!.filter((_, i) => i !== optIndex),
                              })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuestion(index, {
                          options: [
                            ...q.options!,
                            { value: `option_${q.options!.length + 1}`, label: `Option ${q.options!.length + 1}` },
                          ],
                        })
                      }
                    >
                      Add option
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Add question
            </Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={saveSurvey} disabled={saving || !title.trim()}>
              {saving ? "Saving…" : editingId ? "Update draft" : "Save as draft"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Your surveys</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : surveys.length === 0 ? (
          <p className="text-sm text-slate-500">No surveys yet. Create one to collect field data.</p>
        ) : (
          <div className="space-y-3">
            {surveys.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-brand-ink">{s.title}</h4>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusColor[s.status])}>
                        {s.status}
                      </span>
                    </div>
                    {s.description && <p className="mt-1 text-sm text-slate-500">{s.description}</p>}
                    <p className="mt-2 text-xs text-slate-400">
                      {s.questionCount} questions · {s.responseCount} responses
                      {s.dueDate ? ` · Due ${s.dueDate}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.status === "DRAFT" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => loadForEdit(s.id)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="teal" onClick={() => runAction(s.id, "publish")}>
                          Publish
                        </Button>
                      </>
                    )}
                    {s.status === "PUBLISHED" && (
                      <Button size="sm" variant="outline" onClick={() => runAction(s.id, "close")}>
                        Close
                      </Button>
                    )}
                    {s.status === "CLOSED" && (
                      <Button size="sm" variant="outline" onClick={() => runAction(s.id, "reopen")}>
                        Reopen
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deleteSurvey(s.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

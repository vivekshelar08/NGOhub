"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import type { SerializedSurvey, SerializedSurveyResponse } from "@/lib/survey-utils";
import * as XLSX from "xlsx";

interface SurveyResultsPanelProps {
  canExport: boolean;
}

interface QuestionSummary {
  questionId: string;
  label: string;
  type: string;
  aggregates: {
    totalAnswers: number;
    counts?: Record<string, number>;
    average?: number | null;
    min?: number | null;
    max?: number | null;
  };
}

export function SurveyResultsPanel({ canExport }: SurveyResultsPanelProps) {
  const [surveys, setSurveys] = useState<SerializedSurvey[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [summary, setSummary] = useState<QuestionSummary[]>([]);
  const [responses, setResponses] = useState<SerializedSurveyResponse[]>([]);
  const [surveyMeta, setSurveyMeta] = useState<{ title: string; responseCount: number; isAnonymous: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/surveys?mode=manage")
      .then((r) => r.json())
      .then((d) => setSurveys(d.surveys ?? []));
  }, []);

  async function loadResults(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/surveys/${id}/responses`);
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary ?? []);
        setResponses(data.responses ?? []);
        setSurveyMeta(data.survey ?? null);
      }
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    if (!surveyMeta || responses.length === 0) return;

    const rows = responses.map((r) => {
      const row: Record<string, string | number> = {
        "Submitted At": r.submittedAt ?? r.createdAt,
      };
      if (!surveyMeta.isAnonymous && r.submittedBy) {
        row["Submitted By"] = r.submittedBy.name;
        row["Department"] = r.submittedBy.department ?? "";
      }
      for (const q of summary) {
        const ans = r.answers.find((a) => a.questionId === q.questionId);
        const val = ans?.value;
        row[q.label] = Array.isArray(val) ? val.join(", ") : String(val ?? "");
      }
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Responses");
    XLSX.writeFile(wb, `${surveyMeta.title.replace(/\s+/g, "_")}_responses.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[240px] flex-1">
          <label className="mb-1.5 block text-sm font-semibold text-brand-ink/80">Select survey</label>
          <Select value={selectedId} onChange={(e) => {
            setSelectedId(e.target.value);
            loadResults(e.target.value);
          }}>
            <option value="">Choose a survey…</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.responseCount} responses)
              </option>
            ))}
          </Select>
        </div>
        {canExport && selectedId && responses.length > 0 && (
          <Button variant="outline" onClick={exportExcel}>
            Export Excel
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading results…</p>}

      {surveyMeta && !loading && (
        <>
          <Card>
            <CardTitle>{surveyMeta.title}</CardTitle>
            <CardDescription>{surveyMeta.responseCount} submitted responses</CardDescription>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {summary.map((q) => (
              <Card key={q.questionId}>
                <h4 className="font-semibold text-brand-ink">{q.label}</h4>
                <p className="mt-1 text-xs text-slate-400">{q.type.replace(/_/g, " ")} · {q.aggregates.totalAnswers} answers</p>

                {q.aggregates.counts && (
                  <div className="mt-3 space-y-1">
                    {Object.entries(q.aggregates.counts).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{key}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}

                {q.aggregates.average !== undefined && q.aggregates.average !== null && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-xs text-slate-400">Avg</p>
                      <p className="font-bold">{q.aggregates.average.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-xs text-slate-400">Min</p>
                      <p className="font-bold">{q.aggregates.min}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="text-xs text-slate-400">Max</p>
                      <p className="font-bold">{q.aggregates.max}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {responses.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Individual responses</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Submitted</th>
                      {!surveyMeta.isAnonymous && <th className="px-4 py-3">By</th>}
                      {summary.slice(0, 4).map((q) => (
                        <th key={q.questionId} className="px-4 py-3">{q.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {responses.slice(0, 20).map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(r.submittedAt ?? r.createdAt).slice(0, 10)}
                        </td>
                        {!surveyMeta.isAnonymous && (
                          <td className="px-4 py-3">{r.submittedBy?.name ?? "—"}</td>
                        )}
                        {summary.slice(0, 4).map((q) => {
                          const ans = r.answers.find((a) => a.questionId === q.questionId);
                          const val = ans?.value;
                          return (
                            <td key={q.questionId} className="px-4 py-3 max-w-[200px] truncate">
                              {Array.isArray(val) ? val.join(", ") : String(val ?? "—")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

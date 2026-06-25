import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import type { SurveyQuestionValidation, SurveyQuestionOption } from "@/lib/survey-utils";

function serializeResponse(response: {
  id: string;
  surveyId: string;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  submittedBy: { id: string; name: string; department: string | null } | null;
  answers: Array<{ id: string; questionId: string; value: unknown }>;
}) {
  return {
    id: response.id,
    surveyId: response.surveyId,
    status: response.status,
    submittedAt: response.submittedAt?.toISOString() ?? null,
    createdAt: response.createdAt.toISOString(),
    submittedBy: response.submittedBy,
    answers: response.answers.map((a) => ({
      id: a.id,
      questionId: a.questionId,
      value: a.value,
    })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.results")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: "asc" } },
        responses: {
          where: { status: "SUBMITTED" },
          include: {
            submittedBy: { select: { id: true, name: true, department: true } },
            answers: true,
          },
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const summary = survey.questions.map((q) => {
      const answers = survey.responses.flatMap((r) =>
        r.answers.filter((a) => a.questionId === q.id).map((a) => a.value)
      );

      let aggregates: Record<string, unknown> = { totalAnswers: answers.length };

      if (["SINGLE_CHOICE", "DROPDOWN", "YES_NO", "MULTI_CHOICE"].includes(q.type)) {
        const counts: Record<string, number> = {};
        for (const ans of answers) {
          if (Array.isArray(ans)) {
            for (const v of ans) counts[String(v)] = (counts[String(v)] ?? 0) + 1;
          } else {
            counts[String(ans)] = (counts[String(ans)] ?? 0) + 1;
          }
        }
        aggregates = { ...aggregates, counts };
      } else if (["NUMBER", "RATING", "LINEAR_SCALE"].includes(q.type)) {
        const nums = answers.map(Number).filter((n) => !Number.isNaN(n));
        aggregates = {
          ...aggregates,
          average: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
          min: nums.length ? Math.min(...nums) : null,
          max: nums.length ? Math.max(...nums) : null,
        };
      }

      return {
        questionId: q.id,
        label: q.label,
        type: q.type,
        required: q.required,
        options: q.options as SurveyQuestionOption[] | null,
        validation: q.validation as SurveyQuestionValidation | null,
        aggregates,
      };
    });

    return NextResponse.json({
      survey: {
        id: survey.id,
        title: survey.title,
        status: survey.status,
        isAnonymous: survey.isAnonymous,
        responseCount: survey.responses.length,
      },
      summary,
      responses: survey.responses.map((r) =>
        serializeResponse({
          ...r,
          submittedBy: survey.isAnonymous ? null : r.submittedBy,
        })
      ),
    });
  } catch (error) {
    console.error("GET /api/surveys/[id]/responses failed:", error);
    return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });
  }
}

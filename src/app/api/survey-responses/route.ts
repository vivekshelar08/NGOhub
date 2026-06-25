import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { surveyResponseSchema } from "@/lib/validators";
import {
  validateAnswerValue,
  type SurveyQuestionOption,
  type SurveyQuestionValidation,
} from "@/lib/survey-utils";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.fill")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = surveyResponseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid response data" },
        { status: 400 }
      );
    }

    const { surveyId, answers, submit } = parsed.data;

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { questions: true },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status !== "PUBLISHED") {
      return NextResponse.json({ error: "This survey is not accepting responses" }, { status: 400 });
    }

    if (survey.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (survey.dueDate < today) {
        return NextResponse.json({ error: "This survey has passed its due date" }, { status: 400 });
      }
    }

    if (!survey.allowMultipleResponses) {
      const existing = await prisma.surveyResponse.findFirst({
        where: {
          surveyId,
          submittedById: currentUser.id,
          status: "SUBMITTED",
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "You have already submitted this survey" },
          { status: 400 }
        );
      }
    }

    const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));
    const errors: string[] = [];

    for (const question of survey.questions) {
      const value = answerMap.get(question.id);
      const error = validateAnswerValue(
        question.type,
        value,
        question.required,
        question.validation as SurveyQuestionValidation | null,
        question.options as SurveyQuestionOption[] | null
      );
      if (error) errors.push(`${question.label}: ${error}`);
    }

    if (submit && errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId,
        submittedById: survey.isAnonymous ? null : currentUser.id,
        status: submit ? "SUBMITTED" : "IN_PROGRESS",
        submittedAt: submit ? new Date() : null,
        answers: {
          create: answers.map((a) => ({
            questionId: a.questionId,
            value: a.value as object,
          })),
        },
      },
      include: {
        submittedBy: { select: { id: true, name: true, department: true } },
        answers: true,
      },
    });

    return NextResponse.json(
      {
        response: {
          id: response.id,
          surveyId: response.surveyId,
          status: response.status,
          submittedAt: response.submittedAt?.toISOString() ?? null,
          submittedBy: response.submittedBy,
          answers: response.answers.map((a) => ({
            id: a.id,
            questionId: a.questionId,
            value: a.value,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/survey-responses failed:", error);
    return NextResponse.json({ error: "Failed to submit response" }, { status: 500 });
  }
}

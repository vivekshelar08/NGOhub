import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { updateSurveySchema, surveyActionSchema } from "@/lib/validators";
import { parseSurveyDueDate } from "@/lib/survey-utils";

function serializeSurveyDetail(survey: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectId: string | null;
  allowMultipleResponses: boolean;
  isAnonymous: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  dueDate: Date | null;
  publishedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string; department: string | null };
  _count: { questions: number; responses: number };
  questions: Array<{
    id: string;
    order: number;
    type: string;
    label: string;
    description: string | null;
    required: boolean;
    options: unknown;
    validation: unknown;
  }>;
}) {
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    projectId: survey.projectId,
    allowMultipleResponses: survey.allowMultipleResponses,
    isAnonymous: survey.isAnonymous,
    showProgressBar: survey.showProgressBar,
    randomizeQuestions: survey.randomizeQuestions,
    dueDate: survey.dueDate?.toISOString().slice(0, 10) ?? null,
    publishedAt: survey.publishedAt?.toISOString() ?? null,
    closedAt: survey.closedAt?.toISOString() ?? null,
    createdAt: survey.createdAt.toISOString(),
    updatedAt: survey.updatedAt.toISOString(),
    createdBy: survey.createdBy,
    questionCount: survey._count.questions,
    responseCount: survey._count.responses,
    questions: survey.questions.map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      label: q.label,
      description: q.description,
      required: q.required,
      options: q.options,
      validation: q.validation,
    })),
  };
}

const detailInclude = {
  createdBy: { select: { id: true, name: true, department: true } },
  _count: { select: { questions: true, responses: true } },
  questions: { orderBy: { order: "asc" as const } },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.list")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: detailInclude,
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    const canManage = hasFeature(currentUser.role, "surveys.create");
    if (!canManage && survey.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Survey not available" }, { status: 403 });
    }

    return NextResponse.json({ survey: serializeSurveyDetail(survey) });
  } catch (error) {
    console.error("GET /api/surveys/[id] failed:", error);
    return NextResponse.json({ error: "Failed to load survey" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action) {
      const actionParsed = surveyActionSchema.safeParse(body);
      if (!actionParsed.success) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      const now = new Date();
      const updates: Record<string, unknown> = {};

      switch (actionParsed.data.action) {
        case "publish":
          updates.status = "PUBLISHED";
          updates.publishedAt = now;
          break;
        case "close":
          updates.status = "CLOSED";
          updates.closedAt = now;
          break;
        case "archive":
          updates.status = "ARCHIVED";
          break;
        case "reopen":
          updates.status = "PUBLISHED";
          updates.closedAt = null;
          break;
      }

      const survey = await prisma.survey.update({
        where: { id },
        data: updates,
        include: detailInclude,
      });

      return NextResponse.json({ survey: serializeSurveyDetail(survey) });
    }

    const parsed = updateSurveySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(". ");
      return NextResponse.json({ error: message || "Invalid survey data" }, { status: 400 });
    }

    const data = parsed.data;
    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT" && data.questions) {
      return NextResponse.json(
        { error: "Only draft surveys can be edited. Close and duplicate to change questions." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.survey.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          projectId: data.projectId !== undefined ? data.projectId || null : undefined,
          allowMultipleResponses: data.allowMultipleResponses,
          isAnonymous: data.isAnonymous,
          showProgressBar: data.showProgressBar,
          randomizeQuestions: data.randomizeQuestions,
          dueDate:
            data.dueDate !== undefined ? parseSurveyDueDate(data.dueDate) : undefined,
          status: data.status,
        },
      });

      if (data.questions) {
        await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });
        await tx.surveyQuestion.createMany({
          data: data.questions.map((q) => ({
            surveyId: id,
            order: q.order,
            type: q.type,
            label: q.label,
            description: q.description,
            required: q.required,
            options: q.options ?? undefined,
            validation: q.validation ?? undefined,
          })),
        });
      }
    });

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: detailInclude,
    });

    return NextResponse.json({ survey: serializeSurveyDetail(survey!) });
  } catch (error) {
    console.error("PATCH /api/surveys/[id] failed:", error);
    return NextResponse.json({ error: "Failed to update survey" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.survey.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/surveys/[id] failed:", error);
    return NextResponse.json({ error: "Failed to delete survey" }, { status: 500 });
  }
}

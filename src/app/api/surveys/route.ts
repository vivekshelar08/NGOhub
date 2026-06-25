import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { surveySchema } from "@/lib/validators";
import { parseSurveyDueDate } from "@/lib/survey-utils";

function serializeSurvey(
  survey: {
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
    questions?: Array<{
      id: string;
      order: number;
      type: string;
      label: string;
      description: string | null;
      required: boolean;
      options: unknown;
      validation: unknown;
    }>;
  },
  extras?: { myResponseCount?: number }
) {
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
    myResponseCount: extras?.myResponseCount,
    questions: survey.questions?.map((q) => ({
      id: q.id,
      order: q.order,
      type: q.type,
      label: q.label,
      description: q.description,
      required: q.required,
      options: q.options as unknown,
      validation: q.validation as unknown,
    })),
  };
}

const surveyInclude = {
  createdBy: { select: { id: true, name: true, department: true } },
  _count: { select: { questions: true, responses: true } },
} as const;

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.list")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const canManage = hasFeature(currentUser.role, "surveys.create");
    const includeQuestions = searchParams.get("includeQuestions") === "1";

    const where: Record<string, unknown> = {};

    if (mode === "manage" && canManage) {
      // All surveys for designers
    } else if (mode === "fill") {
      where.status = "PUBLISHED";
    } else if (canManage) {
      // default: show all for managers
    } else {
      where.status = "PUBLISHED";
    }

    const surveys = await prisma.survey.findMany({
      where,
      include: {
        ...surveyInclude,
        ...(includeQuestions
          ? {
              questions: { orderBy: { order: "asc" } },
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
    });

    const myCounts = await prisma.surveyResponse.groupBy({
      by: ["surveyId"],
      where: {
        submittedById: currentUser.id,
        status: "SUBMITTED",
      },
      _count: { _all: true },
    });
    const myCountMap = Object.fromEntries(myCounts.map((c) => [c.surveyId, c._count._all]));

    return NextResponse.json({
      surveys: surveys.map((s) =>
        serializeSurvey(s, { myResponseCount: myCountMap[s.id] ?? 0 })
      ),
    });
  } catch (error) {
    console.error("GET /api/surveys failed:", error);
    return NextResponse.json({ error: "Failed to load surveys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || !hasFeature(currentUser.role, "surveys.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = surveySchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => issue.message)
        .join(". ");
      return NextResponse.json({ error: message || "Invalid survey data" }, { status: 400 });
    }

    const data = parsed.data;
    const survey = await prisma.survey.create({
      data: {
        title: data.title,
        description: data.description,
        projectId: data.projectId || null,
        allowMultipleResponses: data.allowMultipleResponses,
        isAnonymous: data.isAnonymous,
        showProgressBar: data.showProgressBar,
        randomizeQuestions: data.randomizeQuestions,
        dueDate: parseSurveyDueDate(data.dueDate),
        createdById: currentUser.id,
        questions: {
          create: data.questions.map((q) => ({
            order: q.order,
            type: q.type,
            label: q.label,
            description: q.description,
            required: q.required,
            options: q.options ?? undefined,
            validation: q.validation ?? undefined,
          })),
        },
      },
      include: {
        ...surveyInclude,
        questions: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ survey: serializeSurvey(survey) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/surveys failed:", error);
    return NextResponse.json({ error: "Failed to create survey" }, { status: 500 });
  }
}

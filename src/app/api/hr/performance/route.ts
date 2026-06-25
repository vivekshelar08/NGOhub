import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { performanceReviewSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.attendance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canManage = hasFeature(currentUser.role, "hr.performance");
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  const where = canManage
    ? userId
      ? { userId }
      : undefined
    : { userId: currentUser.id };

  const reviews = await prisma.performanceReview.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reviews });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !hasFeature(currentUser.role, "hr.performance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = performanceReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { userId, period, rating, comments } = parsed.data;

  if (userId === currentUser.id) {
    return NextResponse.json({ error: "Cannot rate yourself" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const review = await prisma.performanceReview.create({
    data: {
      userId,
      reviewerId: currentUser.id,
      period,
      rating,
      comments,
    },
    include: {
      user: { select: { id: true, name: true, email: true, department: true } },
      reviewer: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ review }, { status: 201 });
}

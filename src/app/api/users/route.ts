import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasFeature } from "@/lib/role-features";
import { createUserSchema } from "@/lib/validators";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !hasFeature(currentUser.role, "admin.users")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      department: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  const canCreate =
    hasFeature(currentUser?.role ?? "STAFF", "admin.users") ||
    hasFeature(currentUser?.role ?? "STAFF", "hr.enrollment");

  if (!currentUser || !canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, password, name, role, phone, department } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      phone,
      department,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      department: true,
      phone: true,
      createdAt: true,
    },
  });

  await prisma.employeeProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, joinDate: new Date() },
    update: {},
  });

  return NextResponse.json({ user }, { status: 201 });
}

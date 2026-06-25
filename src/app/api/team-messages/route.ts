import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  audienceLabel,
  canSendTeamMessages,
  matchesAudience,
} from "@/lib/team-messages";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const messages = await prisma.teamMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    const visible = messages.filter((message) =>
      matchesAudience(user.role, "ACTIVE", message.audience)
    );

    return NextResponse.json({
      messages: visible.map((message) => ({
        id: message.id,
        body: message.body,
        audience: message.audience,
        audienceLabel: audienceLabel(message.audience),
        createdAt: message.createdAt.toISOString(),
        sender: message.sender,
        canSend: canSendTeamMessages(user.role),
      })),
      canSend: canSendTeamMessages(user.role),
    });
  } catch (error) {
    console.error("[team-messages] GET failed:", error);
    return NextResponse.json(
      { error: "Team messages are temporarily unavailable. Please refresh the page." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canSendTeamMessages(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const audience = typeof body.audience === "string" ? body.audience : "ALL";

  if (!text) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Message is too long (max 2000 characters)" }, { status: 400 });
  }

  const validAudiences = ["ALL", "ADMIN", "MANAGER", "ACCOUNTANT", "HR", "COORDINATOR", "STAFF"];
  if (!validAudiences.includes(audience)) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  const message = await prisma.teamMessage.create({
    data: {
      senderId: user.id,
      body: text,
      audience,
    },
    include: { sender: { select: { name: true } } },
  });

  const recipients = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, role: true, status: true },
  });

  const audienceText = audienceLabel(audience);
  const title = `Team message from ${message.sender.name}`;
  const notificationBody =
    audience === "ALL"
      ? text
      : `To ${audienceText}: ${text}`;

  const notifyUsers = recipients.filter((recipient) =>
    matchesAudience(recipient.role, recipient.status, audience)
  );

  if (notifyUsers.length > 0) {
    await prisma.inAppNotification.createMany({
      data: notifyUsers.map((recipient) => ({
        userId: recipient.id,
        title,
        body: notificationBody.slice(0, 500),
        href: "/dashboard",
      })),
    });
  }

  return NextResponse.json({
    message: {
      id: message.id,
      body: message.body,
      audience: message.audience,
      audienceLabel: audienceText,
      createdAt: message.createdAt.toISOString(),
      sender: { id: user.id, name: user.name, role: user.role as Role },
    },
  });
}

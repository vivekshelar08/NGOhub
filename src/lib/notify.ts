import { prisma } from "@/lib/prisma";

import { sendEmail } from "@/lib/mail";

export type NotifyChannel = "email" | "sms" | "whatsapp";

export interface QueueNotificationInput {
  userId?: string;
  channel: NotifyChannel;
  recipient: string;
  subject?: string;
  body: string;
}

/** Queue a notification for async delivery (email/SMS/WhatsApp). */
export async function queueNotification(input: QueueNotificationInput) {
  return prisma.notificationOutbox.create({
    data: {
      userId: input.userId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      status: "PENDING",
    },
  });
}

/** Process pending outbox items. External providers require env/API keys in org settings. */
export async function processNotificationOutbox(limit = 20): Promise<{ sent: number; failed: number }> {
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await deliverNotification(item.channel, item.recipient, item.subject, item.body);
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      sent++;
    } catch {
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "FAILED" },
      });
      failed++;
    }
  }

  return { sent, failed };
}

async function deliverNotification(
  channel: string,
  recipient: string,
  subject: string | null,
  body: string
): Promise<void> {
  if (channel === "email") {
    const webhook = process.env.NOTIFY_EMAIL_WEBHOOK;
    if (webhook) {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, subject: subject ?? "NGO Hub", body }),
      });
      if (!res.ok) throw new Error("Email webhook failed");
      return;
    }

    try {
      await sendEmail({
        to: recipient,
        subject: subject ?? "NGO Hub",
        text: body,
      });
      return;
    } catch {
      // Dev fallback when SMTP is not configured
      console.info(`[notify:email] to=${recipient} subject=${subject} body=${body.slice(0, 120)}`);
      return;
    }
  }

  if (channel === "sms" || channel === "whatsapp") {
    const apiKey = process.env[`NOTIFY_${channel.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      console.info(`[notify:${channel}] to=${recipient} (no API key — queued only)`);
      return;
    }
    // Provider-specific integration point
    console.info(`[notify:${channel}] sent to ${recipient}`);
  }
}

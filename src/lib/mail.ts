import type { SendEmailInput, SmtpConfig } from "@/lib/mail-types";
import { prisma } from "@/lib/prisma";
import { mergeOrgSettings } from "@/lib/orgSettings";

export type { SendEmailInput, SmtpConfig } from "@/lib/mail-types";

/** Resolve SMTP settings: env vars take precedence, then org settings. */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const row = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  const org = mergeOrgSettings(row);

  const host = process.env.SMTP_HOST ?? org.smtpHost ?? "smtp.hostinger.com";
  const port = Number(process.env.SMTP_PORT ?? org.smtpPort ?? 465);
  const user = process.env.SMTP_USER ?? org.smtpUser ?? org.orgEmail;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? user ?? org.orgEmail;

  if (!user || !password || !from) return null;

  return { host, port, user, password, from };
}

type MailTransport = {
  sendMail: (mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) => Promise<unknown>;
};

let cachedTransport: MailTransport | null = null;
let cachedKey = "";

async function getTransport(): Promise<MailTransport> {
  const config = await getSmtpConfig();
  if (!config) {
    throw new Error(
      "Email is not configured. Set SMTP_USER and SMTP_PASSWORD (Hostinger email) in environment variables."
    );
  }

  const key = `${config.host}:${config.port}:${config.user}`;
  if (cachedTransport && cachedKey === key) return cachedTransport;

  const nodemailer = await import("nodemailer");
  cachedTransport = nodemailer.default.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });
  cachedKey = key;
  return cachedTransport;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const config = await getSmtpConfig();
  if (!config) {
    console.info(`[mail] (no SMTP) to=${input.to} subject=${input.subject}`);
    return;
  }

  const transport = await getTransport();
  await transport.sendMail({
    from: `"Svitech HR" <${config.from}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, "<br>"),
  });
}

export function buildPasswordResetEmail(params: {
  name: string;
  resetUrl: string;
  orgName: string;
}): { subject: string; text: string; html: string } {
  const subject = `Reset your ${params.orgName} password`;
  const text = [
    `Hi ${params.name},`,
    "",
    "We received a request to reset your Svitech HR password.",
    `Click the link below to choose a new password (valid for 1 hour):`,
    params.resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    `— ${params.orgName}`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(params.name)},</p>
    <p>We received a request to reset your Svitech HR password.</p>
    <p><a href="${escapeHtml(params.resetUrl)}">Reset your password</a></p>
    <p style="color:#64748b;font-size:13px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
    <p>— ${escapeHtml(params.orgName)}</p>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

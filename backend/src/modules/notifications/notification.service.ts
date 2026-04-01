import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../lib/secrets.js";
import { AppError } from "../../lib/errors.js";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  meta?: Record<string, unknown>;
}

export async function sendEmail(input: SendEmailInput) {
  const log = await prisma.notificationLog.create({
    data: {
      channel: "EMAIL",
      recipient: input.to,
      subject: input.subject,
      payload: { html: input.html, ...(input.meta ?? {}) },
      provider: env.EMAIL_PROVIDER,
      status: "PENDING",
    },
  });

  if (env.EMAIL_PROVIDER === "console") {
    console.log(`[email:${log.id}] to=${input.to} subject=${input.subject}`);
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return;
  }

  if (env.EMAIL_PROVIDER === "sendgrid") {
    try {
      const setting = await prisma.setting.findUnique({ where: { scope_key: { scope: "email", key: "provider.sendgrid" } } });
      const value = (setting?.value ?? {}) as {
        enabled?: boolean;
        fromEmail?: string;
        fromName?: string;
        replyToEmail?: string;
        sandboxMode?: boolean;
        encryptedApiKey?: string;
      };

      if (!value.enabled) throw new AppError(400, "SendGrid is disabled", "SENDGRID_DISABLED");
      const apiKey = value.encryptedApiKey ? decryptSecret(value.encryptedApiKey) : "";
      if (!apiKey) throw new AppError(400, "SendGrid API key not configured", "SENDGRID_API_KEY_MISSING");

      const fromEmail = value.fromEmail || env.EMAIL_FROM;
      const payload = {
        personalizations: [{ to: [{ email: input.to }] }],
        from: value.fromName ? { email: fromEmail, name: value.fromName } : { email: fromEmail },
        subject: input.subject,
        content: [{ type: "text/html", value: input.html }],
        ...(value.replyToEmail ? { reply_to: { email: value.replyToEmail } } : {}),
        ...(value.sandboxMode ? { mail_settings: { sandbox_mode: { enable: true } } } : {}),
      };

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new AppError(400, text || `SendGrid request failed (${response.status})`, "SENDGRID_SEND_FAILED");
      }

      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      return;
    } catch (error) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message.slice(0, 500) : "SendGrid send failed",
        },
      });
      return;
    }
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: { status: "FAILED", error: "Provider integration not configured in this phase" },
  });
}

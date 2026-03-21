import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";

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

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: { status: "FAILED", error: "Provider integration not configured in this phase" },
  });
}

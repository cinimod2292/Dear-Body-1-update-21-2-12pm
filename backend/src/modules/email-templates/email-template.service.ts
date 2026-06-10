import { EmailTemplate, EmailTemplateCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import { sendEmail } from "../notifications/notification.service.js";
import {
  patchTemplateSchema,
  previewSchema,
  templateListQuerySchema,
  testSendSchema,
  upsertTemplateSchema,
} from "./email-template.schemas.js";
import { DEFAULT_EMAIL_TEMPLATES } from "./default-templates.js";

const DEFAULT_SAMPLE_DATA: Record<string, unknown> = {
  firstName: "Customer",
  lastName: "Smith",
  customerName: "Customer Smith",
  storeName: "Dear Body",
  companyName: "Dear Body",
  brandName: "Dear Body",
  supportEmail: "hello@dearbody.com",
  siteUrl: "https://example.com",
  orderNumber: "10001234",
  orderDate: "2026-01-01",
  orderItems: "Hydrating Serum x1, Body Butter x2",
  totalAmount: "$120.00",
  orderTotal: "$120.00",
  amount: "$120.00",
  carrier: "UPS",
  trackingNumber: "1Z12345E0205271688",
  trackingUrl: "https://tracking.example.com/1Z12345E0205271688",
  resetUrl: "https://example.com/reset?token=test",
  verificationUrl: "https://example.com/verify?token=test",
  eventType: "refunded",
  name: "Jane Doe",
  email: "jane@example.com",
  message: "I need help with my order",
  primaryColor: "#f472b6",
  accentColor: "#fb923c",
  buttonBg: "#111827",
  buttonTextColor: "#ffffff",
  headingColor: "#111827",
  bodyTextColor: "#374151",
  contentBg: "#ffffff",
  outerBg: "#f8fafc",
  footerBg: "#111827",
  footerText: "#d1d5db",
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function renderTemplateString(template: string, data: Record<string, unknown>) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}


async function loadEmailTheme(): Promise<Record<string, string>> {
  const setting = await prisma.setting.findUnique({
    where: { scope_key: { scope: "email", key: "template.theme.v1" } },
  });
  if (!setting?.value || typeof setting.value !== "object") return {};
  const v = setting.value as Record<string, unknown>;
  const theme: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") theme[k] = val;
  }
  return theme;
}

async function buildRenderData(sampleData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const theme = await loadEmailTheme();
  const merged: Record<string, unknown> = {
    ...DEFAULT_SAMPLE_DATA,
    ...theme,
    ...(theme.brandName ? { storeName: theme.brandName, companyName: theme.brandName } : {}),
    ...sampleData,
  };
  return merged;
}

const SYSTEM_TEMPLATES_VERSION = "v3-force-theme-tokens";
let systemTemplatesSynced = false;

export async function initEmailTemplates(): Promise<void> {
  systemTemplatesSynced = false;
  await ensureDefaultTemplates();
}

export async function seedDefaultTemplates() {
  const created: string[] = [];
  const updated: string[] = [];

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({ where: { key: template.key } });

    if (!existing) {
      await prisma.emailTemplate.create({
        data: {
          ...template,
          isEnabled: true,
          isSystemDefault: true,
        },
      });
      created.push(template.key);
    } else if (existing.isSystemDefault) {
      await prisma.emailTemplate.update({
        where: { key: template.key },
        data: {
          name: template.name,
          category: template.category,
          subject: template.subject,
          htmlBody: template.htmlBody,
          placeholderKeys: template.placeholderKeys,
          isSystemDefault: true,
        },
      });
      updated.push(template.key);
    }
  }

  systemTemplatesSynced = false;
  return { createdCount: created.length, createdKeys: created, updatedCount: updated.length, updatedKeys: updated };
}

async function ensureDefaultTemplates() {
  if (systemTemplatesSynced) return;

  const versionSetting = await prisma.setting.findUnique({
    where: { scope_key: { scope: "email", key: "template.schema.version" } },
  });

  if ((versionSetting?.value as string) === SYSTEM_TEMPLATES_VERSION) {
    systemTemplatesSynced = true;
    return;
  }

  await seedDefaultTemplates();

  await prisma.setting.upsert({
    where: { scope_key: { scope: "email", key: "template.schema.version" } },
    update: { value: SYSTEM_TEMPLATES_VERSION as any },
    create: { scope: "email", key: "template.schema.version", value: SYSTEM_TEMPLATES_VERSION as any },
  });

  systemTemplatesSynced = true;
}

export async function listEmailTemplates(rawQuery: unknown) {
  await ensureDefaultTemplates();

  const query = templateListQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;

  const where = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.isEnabled !== undefined ? { isEnabled: query.isEnabled } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { key: { contains: query.q, mode: "insensitive" as const } },
            { subject: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.emailTemplate.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: [{ category: "asc" }, { key: "asc" }],
    }),
    prisma.emailTemplate.count({ where }),
  ]);

  return toPaginatedResponse(items, total, {
    page: query.page,
    perPage: query.perPage,
    sortBy: "key",
    sortDir: "asc",
    q: query.q,
  });
}

export async function getEmailTemplate(id: string) {
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) throw new AppError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  return template;
}

export async function createOrUpdateEmailTemplate(rawBody: unknown) {
  const body = upsertTemplateSchema.parse(rawBody);

  return prisma.emailTemplate.upsert({
    where: { key: body.key },
    update: {
      name: body.name,
      category: body.category,
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
      placeholderKeys: body.placeholderKeys,
      isEnabled: body.isEnabled,
    },
    create: {
      key: body.key,
      name: body.name,
      category: body.category,
      subject: body.subject,
      htmlBody: body.htmlBody,
      textBody: body.textBody,
      placeholderKeys: body.placeholderKeys,
      isEnabled: body.isEnabled,
      isSystemDefault: false,
    },
  });
}

export async function patchEmailTemplate(id: string, rawBody: unknown) {
  const body = patchTemplateSchema.parse(rawBody);
  const current = await getEmailTemplate(id);

  return prisma.emailTemplate.update({
    where: { id },
    data: {
      ...(body.key !== undefined ? { key: body.key } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.subject !== undefined ? { subject: body.subject } : {}),
      ...(body.htmlBody !== undefined ? { htmlBody: body.htmlBody } : {}),
      ...(body.textBody !== undefined ? { textBody: body.textBody } : {}),
      ...(body.placeholderKeys !== undefined ? { placeholderKeys: body.placeholderKeys } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
      isSystemDefault: current.isSystemDefault,
    },
  });
}

export async function deleteEmailTemplate(id: string) {
  await getEmailTemplate(id);
  await prisma.emailTemplate.delete({ where: { id } });
  return { deleted: true };
}

export async function resetEmailTemplateToDefault(id: string) {
  const current = await getEmailTemplate(id);
  const fallback = DEFAULT_EMAIL_TEMPLATES.find((item) => item.key === current.key);
  if (!fallback) {
    throw new AppError(400, "Template has no system default", "EMAIL_TEMPLATE_NO_DEFAULT");
  }

  return prisma.emailTemplate.update({
    where: { id },
    data: {
      name: fallback.name,
      category: fallback.category,
      subject: fallback.subject,
      htmlBody: fallback.htmlBody,
      textBody: null,
      placeholderKeys: fallback.placeholderKeys,
      isEnabled: true,
      isSystemDefault: true,
    },
  });
}

interface ResolvedTemplate {
  key: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  placeholderKeys: string[];
  isEnabled: boolean;
  source: "database" | "fallback-default";
}

async function buildResolvedTemplate(template: EmailTemplate, sampleData: Record<string, unknown>): Promise<ResolvedTemplate> {
  const mergedData = await buildRenderData(sampleData);
  return {
    key: template.key,
    name: template.name,
    category: template.category,
    subject: renderTemplateString(template.subject, mergedData),
    htmlBody: renderTemplateString(template.htmlBody, mergedData),
    textBody: template.textBody ? renderTemplateString(template.textBody, mergedData) : template.textBody,
    placeholderKeys: asStringArray(template.placeholderKeys),
    isEnabled: template.isEnabled,
    source: "database",
  };
}

export async function resolveTemplateByKey(key: string, sampleData: Record<string, unknown> = {}) {
  await ensureDefaultTemplates();

  const found = await prisma.emailTemplate.findUnique({ where: { key } });
  if (found?.isEnabled) {
    return buildResolvedTemplate(found, sampleData);
  }

  const fallback = DEFAULT_EMAIL_TEMPLATES.find((item) => item.key === key);
  if (!fallback) {
    throw new AppError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  const mergedData = await buildRenderData(sampleData);
  return {
    key: fallback.key,
    name: fallback.name,
    category: fallback.category,
    subject: renderTemplateString(fallback.subject, mergedData),
    htmlBody: renderTemplateString(fallback.htmlBody, mergedData),
    textBody: null,
    placeholderKeys: fallback.placeholderKeys,
    isEnabled: true,
    source: "fallback-default" as const,
  };
}

export async function previewTemplate(id: string, rawBody: unknown) {
  const body = previewSchema.parse(rawBody);
  const template = await getEmailTemplate(id);
  const rendered = await buildResolvedTemplate(template, body.sampleData);

  return {
    ...rendered,
    missingPlaceholders: rendered.placeholderKeys.filter((key) => body.sampleData[key] === undefined),
  };
}

export async function previewTemplateByKey(key: string, rawBody: unknown) {
  const body = previewSchema.parse(rawBody);
  const rendered = await resolveTemplateByKey(key, body.sampleData);

  return {
    ...rendered,
    missingPlaceholders: rendered.placeholderKeys.filter((placeholderKey) => body.sampleData[placeholderKey] === undefined),
  };
}

export async function sendTestEmailTemplate(id: string, rawBody: unknown) {
  const body = testSendSchema.parse(rawBody);
  const template = await previewTemplate(id, { sampleData: body.sampleData });

  const mergedData = await buildRenderData(body.sampleData);
  const htmlBody = body.htmlBody
    ? renderTemplateString(body.htmlBody, mergedData)
    : template.htmlBody;
  const subject = body.subject
    ? renderTemplateString(body.subject, mergedData)
    : template.subject;

  await sendEmail({
    to: body.to,
    subject: `[TEST] ${subject}`,
    html: htmlBody,
    meta: {
      templateId: id,
      templateKey: template.key,
      source: template.source,
      sampleData: body.sampleData,
    },
  });

  return {
    sent: true,
    to: body.to,
    subject: `[TEST] ${subject}`,
    templateKey: template.key,
    source: template.source,
  };
}

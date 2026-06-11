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
import {
  EmailTheme,
  mergeEmailRenderData,
  renderEmailHtml,
  renderTemplateString,
  retainsSystemDefaultStatus,
} from "./email-template.render.js";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadEmailTheme(): Promise<EmailTheme> {
  const setting = await prisma.setting.findUnique({
    where: { scope_key: { scope: "email", key: "template.theme.v1" } },
  });
  if (!setting?.value || typeof setting.value !== "object") return {};
  return setting.value as EmailTheme;
}

async function buildRenderData(sampleData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const theme = await loadEmailTheme();
  return mergeEmailRenderData(theme, sampleData);
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
      // An admin-authored upsert is a customization. Keeping this true would
      // make the send resolver silently replace the saved HTML with source defaults.
      isSystemDefault: false,
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
      // Once an administrator changes rendered content, production sends must
      // use that database version rather than the bundled system fallback.
      isSystemDefault: retainsSystemDefaultStatus(current.isSystemDefault, body),
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
    htmlBody: renderEmailHtml(template.htmlBody, mergedData),
    textBody: template.textBody ? renderTemplateString(template.textBody, mergedData) : template.textBody,
    placeholderKeys: asStringArray(template.placeholderKeys),
    isEnabled: template.isEnabled,
    source: "database",
  };
}

export async function resolveTemplateByKey(key: string, sampleData: Record<string, unknown> = {}) {
  const mergedData = await buildRenderData(sampleData);

  const dbRecord = await prisma.emailTemplate.findUnique({ where: { key } });
  const sourceTemplate = DEFAULT_EMAIL_TEMPLATES.find((item) => item.key === key);

  if (!sourceTemplate && !dbRecord) {
    throw new AppError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  if (dbRecord && !dbRecord.isEnabled) {
    throw new AppError(404, "Email template not found", "EMAIL_TEMPLATE_NOT_FOUND");
  }

  // For user-customized templates (isSystemDefault=false) use their saved DB HTML.
  // For system defaults always use source-code HTML — it is guaranteed to contain
  // {{themeToken}} placeholders so the live theme is always applied at send time.
  // This bypasses any stale baked-in hex values that may have been saved to the DB.
  const isUserCustomized = dbRecord != null && !dbRecord.isSystemDefault;
  const html = isUserCustomized ? dbRecord.htmlBody : (sourceTemplate?.htmlBody ?? dbRecord!.htmlBody);
  const subject = dbRecord?.subject ?? sourceTemplate?.subject ?? "";
  const textBody = isUserCustomized ? dbRecord.textBody : null;
  const placeholderKeys = isUserCustomized
    ? asStringArray(dbRecord.placeholderKeys)
    : (sourceTemplate?.placeholderKeys ?? []);

  return {
    key,
    name: dbRecord?.name ?? sourceTemplate?.name ?? key,
    category: dbRecord?.category ?? sourceTemplate?.category ?? ("SYSTEM" as EmailTemplateCategory),
    subject: renderTemplateString(subject, mergedData),
    htmlBody: renderEmailHtml(html, mergedData),
    textBody: textBody ? renderTemplateString(textBody, mergedData) : null,
    placeholderKeys,
    isEnabled: dbRecord?.isEnabled ?? true,
    source: (isUserCustomized ? "database" : "fallback-default") as "database" | "fallback-default",
  };
}

export async function previewTemplate(id: string, rawBody: unknown) {
  const body = previewSchema.parse(rawBody);
  const template = await getEmailTemplate(id);
  // Re-use resolveTemplateByKey so system defaults always preview with live theme tokens.
  const rendered = await resolveTemplateByKey(template.key, body.sampleData);

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
    ? renderEmailHtml(body.htmlBody, mergedData)
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

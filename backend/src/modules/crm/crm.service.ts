import { prisma } from "../../lib/prisma.js";
import {
  addCustomerInteractionSchema,
  addCustomerNoteSchema,
  addCustomerTagSchema,
  createCustomerSchema,
  customerListQuerySchema,
  supportInquirySchema,
  updateCustomerSchema,
} from "./crm.schemas.js";
import { toPaginatedResponse } from "../../lib/pagination.js";
import { AppError } from "../../lib/errors.js";

export async function listCustomers(rawQuery: unknown) {
  const query = customerListQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;
  const take = query.perPage;

  const where = {
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" as const } },
            { firstName: { contains: query.q, mode: "insensitive" as const } },
            { lastName: { contains: query.q, mode: "insensitive" as const } },
            { phone: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.marketingEmailConsent !== undefined ? { marketingEmailConsent: query.marketingEmailConsent } : {}),
    ...(query.marketingSmsConsent !== undefined ? { marketingSmsConsent: query.marketingSmsConsent } : {}),
    ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
    ...(query.minLtv !== undefined || query.maxLtv !== undefined
      ? {
          lifetimeValue: {
            ...(query.minLtv !== undefined ? { gte: query.minLtv } : {}),
            ...(query.maxLtv !== undefined ? { lte: query.maxLtv } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: { [query.sortBy]: query.sortDir },
      include: {
        tags: { include: { tag: true } },
        orders: { orderBy: { placedAt: "desc" }, take: 3 },
        abandonedCarts: { where: { recoveredAt: null }, orderBy: { abandonedAt: "desc" }, take: 1 },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return toPaginatedResponse(items, total, query);
}

export async function getCustomerById(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      tags: { include: { tag: true } },
      orders: { orderBy: { placedAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { email: true } } } },
      interactions: { orderBy: { happenedAt: "desc" }, include: { staffUser: { select: { email: true } } } },
      abandonedCarts: { orderBy: { abandonedAt: "desc" } },
      inquiries: { orderBy: { createdAt: "desc" }, include: { assignedTo: { select: { email: true } } } },
    },
  });

  if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
  return customer;
}

export async function createCustomer(rawBody: unknown) {
  const body = createCustomerSchema.parse(rawBody);
  return prisma.customer.create({
    data: {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      status: body.status,
      marketingEmailConsent: body.marketingEmailConsent,
      marketingSmsConsent: body.marketingSmsConsent,
      tags: body.tagIds.length ? { create: body.tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    include: { tags: { include: { tag: true } } },
  });
}

export async function updateCustomer(customerId: string, rawBody: unknown) {
  const body = updateCustomerSchema.parse(rawBody);
  await getCustomerById(customerId);

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.marketingEmailConsent !== undefined ? { marketingEmailConsent: body.marketingEmailConsent } : {}),
      ...(body.marketingSmsConsent !== undefined ? { marketingSmsConsent: body.marketingSmsConsent } : {}),
      ...(body.tagIds ? { tags: { deleteMany: {}, create: body.tagIds.map((tagId) => ({ tagId })) } } : {}),
    },
    include: { tags: { include: { tag: true } } },
  });
}

export async function addCustomerNote(customerId: string, rawBody: unknown, authorId?: string) {
  const body = addCustomerNoteSchema.parse(rawBody);
  await getCustomerById(customerId);
  return prisma.customerNote.create({ data: { customerId, authorId, note: body.note, isPinned: body.isPinned } });
}

export async function addCustomerInteraction(customerId: string, rawBody: unknown, staffUserId?: string) {
  const body = addCustomerInteractionSchema.parse(rawBody);
  await getCustomerById(customerId);
  return prisma.customerInteraction.create({
    data: {
      customerId,
      staffUserId,
      type: body.type,
      channel: body.channel,
      subject: body.subject,
      summary: body.summary,
      happenedAt: body.happenedAt ? new Date(body.happenedAt) : new Date(),
    },
  });
}

export async function addCustomerTag(customerId: string, rawBody: unknown) {
  const body = addCustomerTagSchema.parse(rawBody);
  await getCustomerById(customerId);
  return prisma.customerTag.upsert({ where: { customerId_tagId: { customerId, tagId: body.tagId } }, update: {}, create: { customerId, tagId: body.tagId } });
}

export async function removeCustomerTag(customerId: string, tagId: string) {
  await prisma.customerTag.deleteMany({ where: { customerId, tagId } });
}

export async function createSupportInquiry(rawBody: unknown) {
  const body = supportInquirySchema.parse(rawBody);
  return prisma.supportInquiry.create({ data: body });
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export async function exportCustomersCsv(rawQuery: unknown) {
  const baseQuery = (rawQuery && typeof rawQuery === "object") ? rawQuery : {};
  const paged = await listCustomers({ ...baseQuery, page: 1, perPage: 1000 });
  const header = ["id", "email", "firstName", "lastName", "status", "marketingEmailConsent", "marketingSmsConsent", "lifetimeValue", "averageOrderValue", "lastOrderAt"];
  const lines = [header.join(",")];

  for (const c of paged.items) {
    lines.push([
      c.id,
      c.email,
      c.firstName ?? "",
      c.lastName ?? "",
      c.status,
      c.marketingEmailConsent,
      c.marketingSmsConsent,
      c.lifetimeValue,
      c.averageOrderValue,
      c.lastOrderAt?.toISOString?.() ?? "",
    ].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { z } from "zod";
import { calculateNextCollectionDate, getCollectionSchedule, getSlaStatus } from "./collection-schedule.service.js";
import { sendEmail } from "../notifications/notification.service.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";
import { StockMovementType, WarehouseStatus } from "@prisma/client";

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const startPickingSchema = z.object({
  actorId: z.string().optional(),
});

export const updatePickItemSchema = z.object({
  status: z.enum(["PICKED", "ISSUE"]),
  issueType: z.enum(["NONE", "PARTIAL_STOCK", "OUT_OF_STOCK", "DAMAGED"]).optional(),
  issueNotes: z.string().max(500).optional(),
});

export const completePickingSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const completePackingSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const warehouseStatusUpdateSchema = z.object({
  warehouseStatus: z.enum([
    "PENDING_PICK",
    "PICKING",
    "PICKED",
    "PACKING",
    "PACKED",
    "AWAITING_COLLECTION",
    "EXCEPTION",
  ]),
  notes: z.string().max(1000).optional(),
});

export const warehouseListQuerySchema = z.object({
  warehouseStatus: z.string().optional(),
  stockIssueStatus: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(25),
  slaUrgent: z.coerce.boolean().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function recordOrderEvent(orderId: string, actorId: string | undefined, eventType: string, details?: object) {
  await prisma.orderEvent.create({
    data: { orderId, actorId, eventType, details: details as any },
  });
}

/** Returns the full order with all warehouse-relevant includes. */
async function getWarehouseOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      items: {
        include: {
          pickTaskItems: true,
        },
      },
      shippingMethod: { select: { id: true, name: true, type: true } },
      shippingAddress: true,
      pickedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      packedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  return order;
}

/** Creates PickTaskItem rows for every OrderItem that doesn't have one yet. */
async function ensurePickTaskItems(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { pickTaskItems: true } } },
  });
  if (!order) return;

  const missing = order.items.filter((item) => item.pickTaskItems.length === 0);
  if (missing.length === 0) return;

  await prisma.pickTaskItem.createMany({
    data: missing.map((item) => ({
      orderId,
      orderItemId: item.id,
      status: "PENDING",
      issueType: "NONE",
    })),
    skipDuplicates: true,
  });
}

// ─── Warehouse dashboard list ─────────────────────────────────────────────────

export async function listWarehouseOrders(rawQuery: unknown) {
  const query = warehouseListQuerySchema.parse(rawQuery);
  const skip = (query.page - 1) * query.perPage;

  const now = new Date();
  const urgentCutoff = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hrs from now

  const where: any = {
    warehouseStatus: { not: null },
    ...(query.warehouseStatus ? { warehouseStatus: query.warehouseStatus } : {}),
    ...(query.stockIssueStatus ? { stockIssueStatus: query.stockIssueStatus } : {}),
    ...(query.slaUrgent ? { slaDeadline: { lte: urgentCutoff } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: query.perPage,
      orderBy: [{ slaDeadline: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        orderNumber: true,
        status: true,
        warehouseStatus: true,
        stockIssueStatus: true,
        collectionDate: true,
        collectionWindowStart: true,
        collectionWindowEnd: true,
        slaDeadline: true,
        pickingStartedAt: true,
        pickedAt: true,
        packedAt: true,
        placedAt: true,
        totalAmount: true,
        currency: true,
        warehouseNotes: true,
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: { select: { id: true, sku: true, productName: true, variantTitle: true, quantity: true } },
        shippingMethod: { select: { name: true, type: true } },
        pickedBy: { select: { id: true, firstName: true, lastName: true } },
        packedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const enriched = items.map((order) => ({
    ...order,
    slaStatus: getSlaStatus(order.slaDeadline),
  }));

  return { items: enriched, total, page: query.page, perPage: query.perPage };
}

export async function getWarehouseOrderDetail(orderId: string) {
  const order = await getWarehouseOrder(orderId);
  return {
    ...order,
    slaStatus: getSlaStatus(order.slaDeadline),
  };
}

export async function getWarehouseDashboardSummary() {
  const counts = await prisma.order.groupBy({
    by: ["warehouseStatus"],
    where: { warehouseStatus: { not: null } },
    _count: { _all: true },
  });

  const stockIssues = await prisma.order.count({
    where: {
      warehouseStatus: { not: null, notIn: ["AWAITING_COLLECTION", "EXCEPTION"] },
      stockIssueStatus: { not: "NONE" },
    },
  });

  const now = new Date();
  const urgentCutoff = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const urgentCount = await prisma.order.count({
    where: {
      warehouseStatus: { notIn: ["AWAITING_COLLECTION", "EXCEPTION"] as WarehouseStatus[] },
      slaDeadline: { lte: urgentCutoff, gte: now },
    },
  });

  const missedCount = await prisma.order.count({
    where: {
      warehouseStatus: { notIn: ["AWAITING_COLLECTION", "EXCEPTION"] as WarehouseStatus[] },
      slaDeadline: { lt: now },
    },
  });

  const statusMap: Record<string, number> = {};
  for (const c of counts) {
    if (c.warehouseStatus) statusMap[c.warehouseStatus] = c._count._all;
  }

  return {
    pendingPick: statusMap["PENDING_PICK"] ?? 0,
    picking: statusMap["PICKING"] ?? 0,
    picked: statusMap["PICKED"] ?? 0,
    packing: statusMap["PACKING"] ?? 0,
    packed: statusMap["PACKED"] ?? 0,
    awaitingCollection: statusMap["AWAITING_COLLECTION"] ?? 0,
    exception: statusMap["EXCEPTION"] ?? 0,
    stockIssues,
    urgent: urgentCount,
    missed: missedCount,
  };
}

// ─── Order initialisation on payment ─────────────────────────────────────────

export async function initWarehouseOnPayment(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, warehouseStatus: true, items: { select: { id: true } } },
  });
  if (!order || order.warehouseStatus !== null) return; // already initialised

  const schedule = await getCollectionSchedule();
  let collectionFields: {
    collectionDate?: Date;
    collectionWindowStart?: Date;
    collectionWindowEnd?: Date;
    slaDeadline?: Date;
  } = {};

  if (schedule) {
    const result = calculateNextCollectionDate(schedule);
    if (result) {
      collectionFields = {
        collectionDate: result.collectionDate,
        collectionWindowStart: result.windowStart,
        collectionWindowEnd: result.windowEnd,
        slaDeadline: result.slaDeadline,
      };
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { warehouseStatus: "PENDING_PICK", ...collectionFields },
  });

  await ensurePickTaskItems(orderId);

  await recordOrderEvent(orderId, undefined, "WAREHOUSE_PENDING_PICK", {
    source: "payment_confirmation",
    ...collectionFields,
  });

  // Notify warehouse staff
  await notifyWarehouseNewOrder(orderId).catch((err) => console.warn("[email] send failed", err));
}

// ─── Pick workflow ────────────────────────────────────────────────────────────

export async function startPicking(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, warehouseStatus: true, orderNumber: true },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  if (order.warehouseStatus !== "PENDING_PICK" && order.warehouseStatus !== "EXCEPTION") {
    throw new AppError(400, `Cannot start picking — order is ${order.warehouseStatus}`, "INVALID_WAREHOUSE_STATUS");
  }

  await ensurePickTaskItems(orderId);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      warehouseStatus: "PICKING",
      pickedById: actorId,
      pickingStartedAt: new Date(),
    },
  });

  await recordOrderEvent(orderId, actorId, "WAREHOUSE_PICKING_STARTED");
  return getWarehouseOrder(orderId);
}

export async function updatePickItem(orderId: string, pickTaskItemId: string, rawBody: unknown, actorId: string) {
  const body = updatePickItemSchema.parse(rawBody);

  const item = await prisma.pickTaskItem.findFirst({
    where: { id: pickTaskItemId, orderId },
  });
  if (!item) throw new AppError(404, "Pick task item not found", "PICK_ITEM_NOT_FOUND");

  const updated = await prisma.pickTaskItem.update({
    where: { id: pickTaskItemId },
    data: {
      status: body.status,
      issueType: body.status === "ISSUE" ? (body.issueType ?? "OUT_OF_STOCK") : "NONE",
      issueNotes: body.status === "ISSUE" ? body.issueNotes : null,
      pickedAt: body.status === "PICKED" ? new Date() : item.pickedAt,
    },
  });

  // If there's a stock issue, update the order-level issue status
  if (body.status === "ISSUE" && body.issueType && body.issueType !== "NONE") {
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { stockIssueStatus: true },
    });
    const newIssueStatus = body.issueType === "OUT_OF_STOCK"
      ? "OUT_OF_STOCK"
      : body.issueType === "DAMAGED"
        ? "DAMAGED"
        : "PARTIAL_STOCK";
    if (currentOrder?.stockIssueStatus === "NONE" || currentOrder?.stockIssueStatus !== "OUT_OF_STOCK") {
      await prisma.order.update({
        where: { id: orderId },
        data: { stockIssueStatus: newIssueStatus as any },
      });
    }
  } else if (body.status === "PICKED") {
    // Re-check if all issues are resolved
    const allItems = await prisma.pickTaskItem.findMany({ where: { orderId } });
    const hasIssue = allItems.some((i) => i.id !== pickTaskItemId && i.status === "ISSUE");
    if (!hasIssue) {
      await prisma.order.update({
        where: { id: orderId },
        data: { stockIssueStatus: "NONE" },
      });
    }
  }

  await recordOrderEvent(orderId, actorId, "PICK_ITEM_UPDATED", {
    pickTaskItemId,
    status: body.status,
    issueType: body.issueType,
  });

  return updated;
}

export async function completePicking(orderId: string, rawBody: unknown, actorId: string) {
  const body = completePickingSchema.parse(rawBody);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { pickTaskItems: true } } },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  if (order.warehouseStatus !== "PICKING") {
    throw new AppError(400, "Order is not in PICKING status", "INVALID_WAREHOUSE_STATUS");
  }

  const allPickItems = order.items.flatMap((i) => i.pickTaskItems);
  const allDone = allPickItems.every((p) => p.status === "PICKED" || p.status === "ISSUE");
  if (!allDone) {
    throw new AppError(400, "Not all items have been marked picked or have a reported issue", "PICK_INCOMPLETE");
  }

  const hasIssues = allPickItems.some((p) => p.status === "ISSUE");
  const newWarehouseStatus = hasIssues ? "PICKED" : "PICKED";

  await prisma.order.update({
    where: { id: orderId },
    data: {
      warehouseStatus: newWarehouseStatus,
      pickedAt: new Date(),
      warehouseNotes: body.notes ?? order.warehouseNotes,
    },
  });

  await recordOrderEvent(orderId, actorId, "WAREHOUSE_PICKING_COMPLETE", {
    hasIssues,
    notes: body.notes,
  });

  if (hasIssues) {
    await notifyAdminStockIssue(orderId).catch((err) => console.warn("[email] send failed", err));
  }

  return getWarehouseOrder(orderId);
}

export async function startPacking(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, warehouseStatus: true },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  if (order.warehouseStatus !== "PICKED") {
    throw new AppError(400, `Cannot start packing — order is ${order.warehouseStatus}`, "INVALID_WAREHOUSE_STATUS");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { warehouseStatus: "PACKING", packedById: actorId },
  });

  await recordOrderEvent(orderId, actorId, "WAREHOUSE_PACKING_STARTED");
  return getWarehouseOrder(orderId);
}

export async function completePacking(orderId: string, rawBody: unknown, actorId: string) {
  const body = completePackingSchema.parse(rawBody);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, warehouseStatus: true, warehouseNotes: true },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  if (order.warehouseStatus !== "PACKING") {
    throw new AppError(400, "Order is not in PACKING status", "INVALID_WAREHOUSE_STATUS");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      warehouseStatus: "PACKED",
      packedAt: new Date(),
      warehouseNotes: body.notes ? `${order.warehouseNotes ?? ""}\n[Pack] ${body.notes}`.trim() : order.warehouseNotes,
    },
  });

  await recordOrderEvent(orderId, actorId, "WAREHOUSE_PACKING_COMPLETE", { notes: body.notes });
  return getWarehouseOrder(orderId);
}

export async function markAwaitingCollection(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, warehouseStatus: true },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");
  if (order.warehouseStatus !== "PACKED") {
    throw new AppError(400, "Order is not in PACKED status", "INVALID_WAREHOUSE_STATUS");
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { warehouseStatus: "AWAITING_COLLECTION" },
  });

  await recordOrderEvent(orderId, actorId, "WAREHOUSE_AWAITING_COLLECTION");
  return getWarehouseOrder(orderId);
}

export async function flagWarehouseException(orderId: string, actorId: string, notes: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, warehouseStatus: true, warehouseNotes: true },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const combined = `${order.warehouseNotes ?? ""}\n[Exception] ${notes}`.trim();
  await prisma.order.update({
    where: { id: orderId },
    data: { warehouseStatus: "EXCEPTION", warehouseNotes: combined },
  });

  await recordOrderEvent(orderId, actorId, "WAREHOUSE_EXCEPTION", { notes });
  return getWarehouseOrder(orderId);
}

// ─── Collection date management ───────────────────────────────────────────────

export async function recalculateCollectionDate(orderId: string, actorId?: string) {
  const schedule = await getCollectionSchedule();
  if (!schedule) throw new AppError(400, "No collection schedule configured", "NO_COLLECTION_SCHEDULE");

  const result = calculateNextCollectionDate(schedule);
  if (!result) throw new AppError(400, "No upcoming collection windows found in schedule", "NO_COLLECTION_WINDOW");

  await prisma.order.update({
    where: { id: orderId },
    data: {
      collectionDate: result.collectionDate,
      collectionWindowStart: result.windowStart,
      collectionWindowEnd: result.windowEnd,
      slaDeadline: result.slaDeadline,
    },
  });

  await recordOrderEvent(orderId, actorId, "COLLECTION_DATE_RECALCULATED", {
    collectionDate: result.collectionDate,
    slaDeadline: result.slaDeadline,
    window: result.windowLabel,
  });

  return result;
}

// ─── Inventory adjustments on stock issues ────────────────────────────────────

export async function applyStockIssueAdjustments(orderId: string, actorId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          pickTaskItems: true,
        },
      },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  for (const item of order.items) {
    for (const pickItem of item.pickTaskItems) {
      if (pickItem.status !== "ISSUE" || pickItem.issueType === "NONE") continue;
      if (!item.variantId) continue;

      const inventoryLevel = await prisma.inventoryLevel.findUnique({ where: { variantId: item.variantId } });
      if (!inventoryLevel) continue;

      let delta = 0;
      let reason = "";

      if (pickItem.issueType === "OUT_OF_STOCK") {
        delta = -item.quantity;
        reason = `Stock confirmed out: order ${order.orderNumber}`;
      } else if (pickItem.issueType === "DAMAGED") {
        delta = -item.quantity;
        reason = `Stock damaged: order ${order.orderNumber}`;
      } else if (pickItem.issueType === "PARTIAL_STOCK") {
        // We don't know exact quantity; reduce by half as a conservative estimate
        delta = -Math.floor(item.quantity / 2);
        reason = `Partial stock issue: order ${order.orderNumber}`;
      }

      if (delta !== 0) {
        const before = inventoryLevel.quantityOnHand;
        const after = Math.max(0, before + delta);

        await prisma.$transaction([
          prisma.inventoryLevel.update({
            where: { variantId: item.variantId },
            data: { quantityOnHand: after },
          }),
          prisma.stockMovement.create({
            data: {
              variantId: item.variantId,
              movementType: "MANUAL_ADJUSTMENT" as StockMovementType,
              quantityDelta: delta,
              quantityBefore: before,
              quantityAfter: after,
              reason,
              referenceType: "order",
              referenceId: orderId,
              createdById: actorId,
            },
          }),
        ]);
      }
    }
  }
}

// ─── Packing slip ─────────────────────────────────────────────────────────────

export async function generatePackingSlip(orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      shippingAddress: true,
      shippingMethod: true,
      pickedBy: { select: { firstName: true, lastName: true, email: true } },
      packedBy: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (!order) throw new AppError(404, "Order not found", "ORDER_NOT_FOUND");

  const itemRows = order.items.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.sku}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.productName}${item.variantTitle ? ` — ${item.variantTitle}` : ""}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">☐</td>
    </tr>`).join("");

  const addr = order.shippingAddress;
  const addrStr = addr
    ? [addr.recipientName ?? `${addr.firstName ?? ""} ${addr.lastName ?? ""}`.trim(), addr.line1, addr.line2, addr.suburb, addr.city, addr.postalCode, addr.country].filter(Boolean).join(", ")
    : "—";

  const collectionStr = order.collectionWindowStart
    ? new Date(order.collectionWindowStart).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })
    : "Not scheduled";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Packing Slip — ${order.orderNumber}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#333;max-width:800px;margin:0 auto;padding:20px}
  h1{font-size:18px;margin:0 0 4px}
  .header{display:flex;justify-content:space-between;margin-bottom:20px}
  table{width:100%;border-collapse:collapse}
  th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ddd}
  .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold}
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>PACKING SLIP</h1>
      <p style="margin:0;color:#666">Order #${order.orderNumber}</p>
      <p style="margin:0;color:#666">Placed: ${new Date(order.placedAt).toLocaleDateString("en-ZA")}</p>
    </div>
    <div style="text-align:right">
      <p style="margin:0"><strong>Dear Body</strong></p>
      <p style="margin:0;color:#666">Printed: ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>
    </div>
  </div>

  <table style="margin-bottom:16px">
    <tr>
      <td style="padding:4px 8px;width:50%;vertical-align:top">
        <strong>Ship To</strong><br>
        <span style="color:#555">${addrStr}</span>
      </td>
      <td style="padding:4px 8px;width:50%;vertical-align:top">
        <strong>Collection Window</strong><br>
        <span style="color:#555">${collectionStr}</span><br>
        <strong>Shipping Method</strong><br>
        <span style="color:#555">${order.shippingMethod?.name ?? "—"}</span>
        ${order.trackingNumber ? `<br><strong>Tracking</strong><br><span style="color:#555">${order.trackingNumber}</span>` : ""}
      </td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Product</th>
        <th style="text-align:center">Qty</th>
        <th>Picked ✓</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #ddd;display:flex;gap:32px">
    <div>
      <strong>Picked by:</strong> ${order.pickedBy ? `${order.pickedBy.firstName ?? ""} ${order.pickedBy.lastName ?? ""}`.trim() || order.pickedBy.email : "—"}<br>
      <strong>Picked at:</strong> ${order.pickedAt ? new Date(order.pickedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "—"}
    </div>
    <div>
      <strong>Packed by:</strong> ${order.packedBy ? `${order.packedBy.firstName ?? ""} ${order.packedBy.lastName ?? ""}`.trim() || order.packedBy.email : "—"}<br>
      <strong>Packed at:</strong> ${order.packedAt ? new Date(order.packedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "—"}
    </div>
  </div>
  <p style="margin-top:16px;font-size:10px;color:#999">Dear Body internal document — not for customer</p>
</body>
</html>`;
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function getWarehouseStaffEmails(): Promise<string[]> {
  const staff = await prisma.staffUser.findMany({
    where: { role: "WAREHOUSE_OPERATOR", status: "ACTIVE" },
    select: { email: true },
  });
  // Also notify STORE_MANAGER for critical events
  const managers = await prisma.staffUser.findMany({
    where: { role: "STORE_MANAGER", status: "ACTIVE" },
    select: { email: true },
  });
  return [...staff, ...managers].map((s) => s.email);
}

async function notifyWarehouseNewOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, items: true },
  });
  if (!order) return;

  const emails = await getWarehouseStaffEmails();
  if (emails.length === 0) return;

  const itemsSummary = order.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ");
  const collectionInfo = order.collectionDate
    ? new Date(order.collectionDate).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })
    : "Not scheduled";

  const subject = `New Order Ready for Picking — #${order.orderNumber}`;
  const html = `<p>A new paid order is ready for picking.</p>
<p><strong>Order:</strong> #${order.orderNumber}<br>
<strong>Customer:</strong> ${order.customer?.firstName ?? ""} ${order.customer?.lastName ?? ""}  ${order.customer?.email ?? ""}<br>
<strong>Items:</strong> ${itemsSummary}<br>
<strong>Collection Window:</strong> ${collectionInfo}</p>
<p>Please log in to the warehouse dashboard to begin picking.</p>`;

  for (const email of emails) {
    await sendEmail({ to: email, subject, html, meta: { orderId, templateKey: "warehouse_new_order" } }).catch((err) => console.warn("[email] send failed", err));
  }
}

async function notifyAdminStockIssue(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true } },
      items: { include: { pickTaskItems: true } },
    },
  });
  if (!order) return;

  const issueItems = order.items.filter((i) => i.pickTaskItems.some((p) => p.status === "ISSUE"));
  if (issueItems.length === 0) return;

  const adminEmails = await prisma.staffUser.findMany({
    where: { role: { in: ["SUPER_ADMIN", "STORE_MANAGER"] }, status: "ACTIVE" },
    select: { email: true },
  });

  const issueLines = issueItems.map((item) => {
    const pick = item.pickTaskItems.find((p) => p.status === "ISSUE");
    return `${item.productName} — ${pick?.issueType ?? "issue"}${pick?.issueNotes ? `: ${pick.issueNotes}` : ""}`;
  }).join("<br>");

  const subject = `Stock Issue Alert — Order #${order.orderNumber}`;
  const html = `<p>A stock issue has been reported during picking for order <strong>#${order.orderNumber}</strong>.</p>
<p><strong>Issues:</strong><br>${issueLines}</p>
<p>Please review and take action.</p>`;

  for (const staff of adminEmails) {
    await sendEmail({ to: staff.email, subject, html, meta: { orderId, templateKey: "warehouse_stock_issue" } }).catch((err) => console.warn("[email] send failed", err));
  }
}

export async function notifySlaWarning(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, warehouseStatus: true, slaDeadline: true, customer: { select: { email: true } } },
  });
  if (!order || !order.slaDeadline) return;

  const slaStatus = getSlaStatus(order.slaDeadline);
  if (slaStatus !== "red" && slaStatus !== "critical") return;

  const emails = await getWarehouseStaffEmails();
  const minsLeft = Math.max(0, Math.round((order.slaDeadline.getTime() - Date.now()) / 60000));

  const subject = `SLA Warning — Order #${order.orderNumber} needs immediate attention`;
  const html = `<p>Order <strong>#${order.orderNumber}</strong> is approaching its collection deadline.</p>
<p><strong>Time remaining:</strong> ${minsLeft} minutes<br>
<strong>Current status:</strong> ${order.warehouseStatus}<br>
<strong>Deadline:</strong> ${order.slaDeadline.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</p>`;

  for (const email of emails) {
    await sendEmail({ to: email, subject, html, meta: { orderId, templateKey: "warehouse_sla_warning" } }).catch((err) => console.warn("[email] send failed", err));
  }
}

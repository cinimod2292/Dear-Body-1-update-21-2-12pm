import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface AuditEventInput {
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(event: AuditEventInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: event.actorUserId,
      actorEmail: event.actorEmail,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      details: event.details as Prisma.InputJsonValue | undefined,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    },
  });
}

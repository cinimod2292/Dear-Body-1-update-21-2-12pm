import geoip from "geoip-lite";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { verifyAdminPassword } from "../auth/auth.service.js";

const pageViewSchema = z.object({
  sessionId: z.string().min(1).max(64),
  path: z.string().min(1).max(2048),
  referrer: z.string().max(2048).optional().nullable(),
  userAgent: z.string().max(512).optional().nullable(),
});

const pageLeaveSchema = z.object({
  sessionId: z.string().min(1).max(64),
  path: z.string().min(1).max(2048),
  duration: z.number().int().min(0).max(86400),
});

function lookupGeo(ip: string) {
  const cleaned = ip.split(",")[0].trim();
  const geo = geoip.lookup(cleaned);
  return { country: geo?.country ?? null, city: geo?.city ?? null };
}

export async function trackPageView(rawBody: unknown, ip: string) {
  const body = pageViewSchema.parse(rawBody);
  const { country, city } = lookupGeo(ip);
  await prisma.pageView.create({
    data: {
      sessionId: body.sessionId,
      path: body.path,
      referrer: body.referrer ?? null,
      userAgent: body.userAgent ?? null,
      country,
      city,
    },
  });
}

export async function trackPageLeave(rawBody: unknown) {
  const body = pageLeaveSchema.parse(rawBody);
  await prisma.pageView.updateMany({
    where: {
      sessionId: body.sessionId,
      path: body.path,
      duration: null,
    },
    data: { duration: body.duration },
  });
}

function getDateRange(rawQuery: unknown): { from: Date; to: Date } {
  const q = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(rawQuery ?? {});
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export async function getLiveVisitors() {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.pageView.findMany({
    where: { createdAt: { gte: since } },
    select: { sessionId: true },
    distinct: ["sessionId"],
  });
  return { count: result.length, since: since.toISOString() };
}

export async function getSiteOverview(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const where = { createdAt: { gte: from, lte: to } };

  const [totalViews, sessions, durationsAgg] = await Promise.all([
    prisma.pageView.count({ where }),
    prisma.pageView.findMany({ where, select: { sessionId: true }, distinct: ["sessionId"] }),
    prisma.pageView.aggregate({ _avg: { duration: true }, where: { ...where, duration: { not: null } } }),
  ]);

  const uniqueSessions = sessions.length;
  const avgDuration = Math.round(durationsAgg._avg.duration ?? 0);
  const bounced = await prisma.pageView.groupBy({
    by: ["sessionId"],
    where,
    _count: { _all: true },
    having: { sessionId: { _count: { equals: 1 } } },
  });
  const bounceRate = uniqueSessions > 0 ? Math.round((bounced.length / uniqueSessions) * 100) : 0;

  return { dateRange: { from, to }, totalViews, uniqueSessions, avgDuration, bounceRate };
}

export async function getTopPages(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const grouped = await prisma.pageView.groupBy({
    by: ["path"],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
    orderBy: { _count: { path: "desc" } },
    take: 20,
  });
  return grouped.map((g) => ({ path: g.path, views: g._count._all }));
}

export async function getLocationBreakdown(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const grouped = await prisma.pageView.groupBy({
    by: ["country"],
    where: { createdAt: { gte: from, lte: to }, country: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
    take: 30,
  });
  return grouped.map((g) => ({ country: g.country ?? "Unknown", views: g._count._all }));
}

export async function getViewsByDay(rawQuery: unknown) {
  const { from, to } = getDateRange(rawQuery);
  const views = await prisma.pageView.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { createdAt: true, sessionId: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay: Record<string, { date: string; views: number; sessions: Set<string> }> = {};
  for (const v of views) {
    const day = v.createdAt.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, views: 0, sessions: new Set() };
    byDay[day].views++;
    byDay[day].sessions.add(v.sessionId);
  }

  return Object.values(byDay).map(({ date, views, sessions }) => ({
    date,
    views,
    sessions: sessions.size,
  }));
}

const deleteAnalyticsSchema = z.object({
  confirmation: z.literal("DELETE ALL ANALYTICS"),
  password: z.string().min(1),
});

export async function deleteAllAnalytics(rawBody: unknown, actorId: string) {
  const parsed = deleteAnalyticsSchema.parse(rawBody);
  await verifyAdminPassword(actorId, parsed.password);
  const { count } = await prisma.pageView.deleteMany({});
  return { deletedRows: count };
}

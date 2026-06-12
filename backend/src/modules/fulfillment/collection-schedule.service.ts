import { prisma } from "../../lib/prisma.js";
import { z } from "zod";

const TZ = "Africa/Johannesburg";

export const collectionWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0=Sun, 1=Mon ... 6=Sat
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  label: z.string().optional(),
});

export const collectionScheduleSchema = z.object({
  windows: z.array(collectionWindowSchema).min(1),
  timezone: z.string().default(TZ),
  cutoffMinutesBefore: z.number().int().min(0).max(480).default(60),
  enabled: z.boolean().default(true),
  // "fixed"  — assign the next upcoming window (original behaviour)
  // "dynamic" — assign now + hoursAfterOrder if inside a window,
  //             otherwise nextWindowStart + fallbackHoursFromWindowStart
  mode: z.enum(["fixed", "dynamic"]).default("fixed"),
  dynamicHoursAfterOrder: z.number().min(0.5).max(48).default(2),
  dynamicFallbackHoursFromWindowStart: z.number().min(0).max(24).default(2),
});

export type CollectionWindow = z.infer<typeof collectionWindowSchema>;
export type CollectionSchedule = z.infer<typeof collectionScheduleSchema>;

const SETTING_SCOPE = "fulfillment";
const SETTING_KEY = "collection_schedule";           // PUDO pickup schedule (existing data)
const WAREHOUSE_CUSTOMER_KEY = "warehouse_customer_schedule"; // When customers collect from warehouse

export async function getCollectionSchedule(): Promise<CollectionSchedule | null> {
  const record = await prisma.setting.findUnique({
    where: { scope_key: { scope: SETTING_SCOPE, key: SETTING_KEY } },
  });
  if (!record) return null;
  const parsed = collectionScheduleSchema.safeParse(record.value);
  return parsed.success ? parsed.data : null;
}

/** Returns the warehouse customer schedule, seeding a Mon–Fri 09:00–17:00 default if none is configured. */
export async function getOrCreateDefaultCollectionSchedule(): Promise<CollectionSchedule> {
  const record = await prisma.setting.findUnique({
    where: { scope_key: { scope: SETTING_SCOPE, key: WAREHOUSE_CUSTOMER_KEY } },
  });
  const parsed = record ? collectionScheduleSchema.safeParse(record.value) : null;
  if (parsed?.success) return parsed.data;

  const defaultSchedule: CollectionSchedule = {
    windows: [1, 2, 3, 4, 5].map((d) => ({
      dayOfWeek: d,
      startTime: "09:00",
      endTime: "17:00",
      label: ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][d],
    })),
    timezone: TZ,
    cutoffMinutesBefore: 60,
    enabled: true,
    mode: "fixed",
    dynamicHoursAfterOrder: 2,
    dynamicFallbackHoursFromWindowStart: 2,
  };

  await prisma.setting.upsert({
    where: { scope_key: { scope: SETTING_SCOPE, key: WAREHOUSE_CUSTOMER_KEY } },
    update: { value: defaultSchedule as any },
    create: { scope: SETTING_SCOPE, key: WAREHOUSE_CUSTOMER_KEY, value: defaultSchedule as any },
  });

  return defaultSchedule;
}

/** Warehouse customer collection schedule — when customers come to collect orders. */
export async function getWarehouseCustomerSchedule(): Promise<CollectionSchedule | null> {
  const record = await prisma.setting.findUnique({
    where: { scope_key: { scope: SETTING_SCOPE, key: WAREHOUSE_CUSTOMER_KEY } },
  });
  if (!record) return null;
  const parsed = collectionScheduleSchema.safeParse(record.value);
  return parsed.success ? parsed.data : null;
}

export async function upsertWarehouseCustomerSchedule(rawBody: unknown): Promise<CollectionSchedule> {
  const schedule = collectionScheduleSchema.parse(rawBody);
  await prisma.setting.upsert({
    where: { scope_key: { scope: SETTING_SCOPE, key: WAREHOUSE_CUSTOMER_KEY } },
    update: { value: schedule as any },
    create: { scope: SETTING_SCOPE, key: WAREHOUSE_CUSTOMER_KEY, value: schedule as any },
  });
  return schedule;
}

/** PUDO pickup schedule — when the PUDO courier collects parcels from the warehouse. */
export async function getPudoPickupSchedule(): Promise<CollectionSchedule | null> {
  const record = await prisma.setting.findUnique({
    where: { scope_key: { scope: SETTING_SCOPE, key: SETTING_KEY } },
  });
  if (!record) return null;
  const parsed = collectionScheduleSchema.safeParse(record.value);
  return parsed.success ? parsed.data : null;
}

export async function upsertPudoPickupSchedule(rawBody: unknown): Promise<CollectionSchedule> {
  const schedule = collectionScheduleSchema.parse(rawBody);
  await prisma.setting.upsert({
    where: { scope_key: { scope: SETTING_SCOPE, key: SETTING_KEY } },
    update: { value: schedule as any },
    create: { scope: SETTING_SCOPE, key: SETTING_KEY, value: schedule as any },
  });
  return schedule;
}

export async function upsertCollectionSchedule(rawBody: unknown): Promise<CollectionSchedule> {
  return upsertPudoPickupSchedule(rawBody);
}

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Returns the weekday (0=Sun..6=Sat) for a Date in the given timezone. */
function getDayOfWeekInTz(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const map: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  return map[weekday ?? "Sunday"] ?? 0;
}

/** Returns the ISO date string (YYYY-MM-DD) for a Date in the given timezone. */
function getIsoDateInTz(date: Date, tz: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: tz }); // en-CA gives YYYY-MM-DD
}

/**
 * Builds a proper UTC Date representing year-month-day HH:MM in Africa/Johannesburg (UTC+2).
 * SAST is always UTC+2 (no DST), so the offset is fixed.
 */
function buildJhbDateTime(isoDate: string, hours: number, minutes: number): Date {
  return new Date(`${isoDate}T${pad2(hours)}:${pad2(minutes)}:00+02:00`);
}

export interface CollectionDateResult {
  collectionDate: Date;
  windowStart: Date;
  windowEnd: Date;
  slaDeadline: Date;
  windowLabel: string;
  daysOfWeek: number[];
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sortedWindowsByWeekday(windows: CollectionWindow[]) {
  return [...windows].sort((a, b) => {
    const da = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const db = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return da - db;
  });
}

/**
 * Calculates the next collection date/time from `from`.
 *
 * Two modes (controlled by schedule.mode):
 *
 * "fixed"   — Finds the next upcoming window and assigns its start time as the
 *             collection date.  The SLA deadline is cutoffMinutesBefore before
 *             that window opens (original behaviour).
 *
 * "dynamic" — If `from` falls inside a window:
 *               collectionDate = from + dynamicHoursAfterOrder
 *               slaDeadline    = collectionDate (pack by then)
 *             If `from` is outside all windows:
 *               collectionDate = nextWindowStart + dynamicFallbackHoursFromWindowStart
 *               slaDeadline    = nextWindowStart (pack before the window opens)
 *
 * All times are interpreted in Africa/Johannesburg (SAST, UTC+2, no DST).
 */
export function calculateNextCollectionDate(
  schedule: CollectionSchedule,
  from: Date = new Date(),
): CollectionDateResult | null {
  if (!schedule.enabled || schedule.windows.length === 0) return null;

  const sorted = sortedWindowsByWeekday(schedule.windows);
  const daysOfWeek = sorted.map((w) => w.dayOfWeek);

  // ── Dynamic mode ────────────────────────────────────────────────────────────
  if (schedule.mode === "dynamic") {
    const hoursAfterMs = (schedule.dynamicHoursAfterOrder ?? 2) * 3_600_000;
    const fallbackHoursMs = (schedule.dynamicFallbackHoursFromWindowStart ?? 2) * 3_600_000;

    // 1. Check if we're currently inside any window
    const todayIso = getIsoDateInTz(from, TZ);
    const todayDow = getDayOfWeekInTz(from, TZ);
    for (const w of sorted) {
      if (w.dayOfWeek !== todayDow) continue;
      const st = parseTime(w.startTime);
      const et = parseTime(w.endTime);
      const windowStart = buildJhbDateTime(todayIso, st.hours, st.minutes);
      const windowEnd   = buildJhbDateTime(todayIso, et.hours, et.minutes);
      if (from >= windowStart && from < windowEnd) {
        const collectionDate = new Date(from.getTime() + hoursAfterMs);
        return {
          collectionDate,
          windowStart,
          windowEnd,
          slaDeadline: collectionDate,
          windowLabel: `${DAY_SHORT[w.dayOfWeek]} ${w.startTime}–${w.endTime} (+${schedule.dynamicHoursAfterOrder ?? 2}h)`,
          daysOfWeek,
        };
      }
    }

    // 2. Not inside any window — find the next window start
    for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
      const candidate    = new Date(from.getTime() + dayOffset * 86_400_000);
      const candidateIso = getIsoDateInTz(candidate, TZ);
      const candidateDow = getDayOfWeekInTz(candidate, TZ);
      for (const w of sorted) {
        if (w.dayOfWeek !== candidateDow) continue;
        const st = parseTime(w.startTime);
        const et = parseTime(w.endTime);
        const windowStart = buildJhbDateTime(candidateIso, st.hours, st.minutes);
        if (from >= windowStart) continue; // already past this window start
        const windowEnd      = buildJhbDateTime(candidateIso, et.hours, et.minutes);
        const collectionDate = new Date(windowStart.getTime() + fallbackHoursMs);
        return {
          collectionDate,
          windowStart,
          windowEnd,
          slaDeadline: windowStart,
          windowLabel: `${DAY_SHORT[w.dayOfWeek]} ${w.startTime}–${w.endTime} (+${schedule.dynamicFallbackHoursFromWindowStart ?? 2}h from open)`,
          daysOfWeek,
        };
      }
    }

    return null;
  }

  // ── Fixed mode (original behaviour) ─────────────────────────────────────────
  const cutoffMs = schedule.cutoffMinutesBefore * 60 * 1000;

  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    const candidate    = new Date(from.getTime() + dayOffset * 86_400_000);
    const candidateIso = getIsoDateInTz(candidate, TZ);
    const candidateDow = getDayOfWeekInTz(candidate, TZ);

    for (const w of sorted) {
      if (w.dayOfWeek !== candidateDow) continue;
      const st = parseTime(w.startTime);
      const windowStart = buildJhbDateTime(candidateIso, st.hours, st.minutes);
      const cutoffTime  = new Date(windowStart.getTime() - cutoffMs);
      if (from >= cutoffTime) continue; // past cutoff — skip to next window
      const et = parseTime(w.endTime);
      const windowEnd = buildJhbDateTime(candidateIso, et.hours, et.minutes);
      return {
        collectionDate: windowStart,
        windowStart,
        windowEnd,
        slaDeadline: cutoffTime,
        windowLabel: `${DAY_SHORT[w.dayOfWeek]} ${w.startTime}–${w.endTime}`,
        daysOfWeek,
      };
    }
  }

  return null;
}

export function getSlaStatus(slaDeadline: Date | null | undefined): "green" | "amber" | "red" | "critical" | "missed" {
  if (!slaDeadline) return "green";
  const now = new Date();
  const msLeft = slaDeadline.getTime() - now.getTime();
  const hoursLeft = msLeft / (1000 * 60 * 60);

  if (msLeft < 0) return "missed";
  if (hoursLeft <= 0.5) return "critical";
  if (hoursLeft <= 1) return "red";
  if (hoursLeft <= 3) return "amber";
  return "green";
}

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
});

export type CollectionWindow = z.infer<typeof collectionWindowSchema>;
export type CollectionSchedule = z.infer<typeof collectionScheduleSchema>;

const SETTING_SCOPE = "fulfillment";
const SETTING_KEY = "collection_schedule";

export async function getCollectionSchedule(): Promise<CollectionSchedule | null> {
  const record = await prisma.setting.findUnique({
    where: { scope_key: { scope: SETTING_SCOPE, key: SETTING_KEY } },
  });
  if (!record) return null;
  const parsed = collectionScheduleSchema.safeParse(record.value);
  return parsed.success ? parsed.data : null;
}

export async function upsertCollectionSchedule(rawBody: unknown): Promise<CollectionSchedule> {
  const schedule = collectionScheduleSchema.parse(rawBody);
  await prisma.setting.upsert({
    where: { scope_key: { scope: SETTING_SCOPE, key: SETTING_KEY } },
    update: { value: schedule as any },
    create: { scope: SETTING_SCOPE, key: SETTING_KEY, value: schedule as any },
  });
  return schedule;
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

/**
 * Calculates the next available collection window from now.
 * All window times are interpreted in Africa/Johannesburg (UTC+2, no DST).
 */
export function calculateNextCollectionDate(
  schedule: CollectionSchedule,
  from: Date = new Date(),
): CollectionDateResult | null {
  if (!schedule.enabled || schedule.windows.length === 0) return null;

  const cutoffMs = schedule.cutoffMinutesBefore * 60 * 1000;

  // Sort windows: Monday first (day 1) wrapping to Sunday (0) last
  const sortedWindows = [...schedule.windows].sort((a, b) => {
    const da = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const db = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return da - db;
  });

  // Try up to 14 days from now to find the next collection window
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    // Compute the candidate date offset from "from" in SAST
    const candidateDate = new Date(from.getTime() + dayOffset * 86_400_000);
    const candidateIsoDate = getIsoDateInTz(candidateDate, TZ);
    const candidateDow = getDayOfWeekInTz(candidateDate, TZ);

    for (const window of sortedWindows) {
      if (window.dayOfWeek !== candidateDow) continue;

      const endTime = parseTime(window.endTime);
      const windowEndTime = buildJhbDateTime(candidateIsoDate, endTime.hours, endTime.minutes);
      const cutoffTime = new Date(windowEndTime.getTime() - cutoffMs);

      // Skip if we're past the cutoff for this window
      if (from >= cutoffTime) continue;

      const startTime = parseTime(window.startTime);
      const windowStartTime = buildJhbDateTime(candidateIsoDate, startTime.hours, startTime.minutes);

      return {
        collectionDate: windowStartTime,
        windowStart: windowStartTime,
        windowEnd: windowEndTime,
        slaDeadline: cutoffTime,
        windowLabel: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][window.dayOfWeek]} ${window.startTime}–${window.endTime}`,
        daysOfWeek: sortedWindows.map((w) => w.dayOfWeek),
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

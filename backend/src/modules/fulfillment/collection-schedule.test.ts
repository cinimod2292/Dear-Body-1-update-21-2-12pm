import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateNextCollectionDate, getSlaStatus, type CollectionSchedule } from "./collection-schedule.service.js";

const TZ = "Africa/Johannesburg";

function jhbDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Build an ISO string in SAST (UTC+2), then parse as UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+02:00`;
  return new Date(isoStr);
}

const baseSchedule: CollectionSchedule = {
  windows: [
    { dayOfWeek: 1, startTime: "09:00", endTime: "11:00" }, // Monday
    { dayOfWeek: 3, startTime: "14:00", endTime: "16:00" }, // Wednesday
    { dayOfWeek: 5, startTime: "08:00", endTime: "10:00" }, // Friday
  ],
  timezone: TZ,
  cutoffMinutesBefore: 60,
  enabled: true,
};

describe("calculateNextCollectionDate", () => {
  it("returns null when schedule is disabled", () => {
    const result = calculateNextCollectionDate({ ...baseSchedule, enabled: false });
    assert.equal(result, null);
  });

  it("returns null when windows array is empty", () => {
    const result = calculateNextCollectionDate({ ...baseSchedule, windows: [] });
    assert.equal(result, null);
  });

  it("returns the current day's window when before cutoff", () => {
    // Wednesday 10:00 SAST — cutoff is 13:00 (14:00 start - 60min), window is still available
    const from = jhbDate(2026, 6, 10, 10, 0); // Wednesday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    assert.equal(result.windowLabel, "Wed 14:00–16:00");
  });

  it("skips current day when past cutoff and returns next scheduled day", () => {
    // Wednesday 15:30 SAST — cutoff at 13:00 (14:00 start - 60min), window is missed
    const from = jhbDate(2026, 6, 10, 15, 30); // Wednesday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    // Next window should be Friday 08:00-10:00
    assert.equal(result.windowLabel, "Fri 08:00–10:00");
  });

  it("skips exact cutoff time and goes to next window", () => {
    // Wednesday 13:00 SAST — exactly at the cutoff (14:00 start - 60min = 13:00)
    const from = jhbDate(2026, 6, 10, 13, 0); // Wednesday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    // Exactly at cutoff (>= check), should go to Friday
    assert.equal(result.windowLabel, "Fri 08:00–10:00");
  });

  it("returns Monday window from Saturday", () => {
    // Saturday any time — next available is Monday
    const from = jhbDate(2026, 6, 13, 10, 0); // Saturday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    assert.equal(result.windowLabel, "Mon 09:00–11:00");
  });

  it("returns Monday window from Sunday", () => {
    // Sunday 12:00 — next available is Monday 09:00
    const from = jhbDate(2026, 6, 14, 12, 0); // Sunday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    assert.equal(result.windowLabel, "Mon 09:00–11:00");
  });

  it("calculates slaDeadline correctly (cutoff before window start)", () => {
    // Tuesday 10:00 SAST — next is Wednesday 14:00-16:00, cutoff = 14:00 - 60min = 13:00 SAST = 11:00 UTC
    const from = jhbDate(2026, 6, 9, 10, 0); // Tuesday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    // Window start = Wednesday 14:00 SAST = 12:00 UTC
    // SLA deadline = 13:00 SAST = 11:00 UTC
    assert.equal(result.slaDeadline.getUTCHours(), 11);
  });

  it("handles zero cutoff — valid right up until window start", () => {
    const schedule: CollectionSchedule = { ...baseSchedule, cutoffMinutesBefore: 0 };
    // Monday 08:59 — one minute before window start, zero cutoff means cutoff = 09:00 exactly
    const from = jhbDate(2026, 6, 8, 8, 59); // Monday
    const result = calculateNextCollectionDate(schedule, from);
    assert.ok(result, "Expected a result");
    assert.equal(result.windowLabel, "Mon 09:00–11:00");
  });

  it("wraps to next week when all windows this week are past cutoff", () => {
    // Friday 09:30 — cutoff is 07:00 (08:00 start - 60min), window is missed
    const from = jhbDate(2026, 6, 12, 9, 30); // Friday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    // Next available is Monday next week
    assert.equal(result.windowLabel, "Mon 09:00–11:00");
  });

  it("returns correct collectionDate and windowStart/End for Wednesday window", () => {
    const from = jhbDate(2026, 6, 9, 8, 0); // Tuesday
    const result = calculateNextCollectionDate(baseSchedule, from);
    assert.ok(result, "Expected a result");
    // Wednesday 14:00-16:00 SAST = 12:00-14:00 UTC
    assert.equal(result.windowStart.getUTCHours(), 12); // 14:00 SAST = 12:00 UTC
    assert.equal(result.windowEnd.getUTCHours(), 14);   // 16:00 SAST = 14:00 UTC
  });
});

describe("getSlaStatus", () => {
  it("returns green when deadline is more than 3 hours away", () => {
    const deadline = new Date(Date.now() + 4 * 3600 * 1000);
    assert.equal(getSlaStatus(deadline), "green");
  });

  it("returns amber when deadline is between 1 and 3 hours away", () => {
    const deadline = new Date(Date.now() + 2 * 3600 * 1000);
    assert.equal(getSlaStatus(deadline), "amber");
  });

  it("returns red when deadline is between 30 min and 1 hour away", () => {
    const deadline = new Date(Date.now() + 45 * 60 * 1000);
    assert.equal(getSlaStatus(deadline), "red");
  });

  it("returns critical when deadline is less than 30 min away", () => {
    const deadline = new Date(Date.now() + 20 * 60 * 1000);
    assert.equal(getSlaStatus(deadline), "critical");
  });

  it("returns missed when deadline is in the past", () => {
    const deadline = new Date(Date.now() - 1000);
    assert.equal(getSlaStatus(deadline), "missed");
  });

  it("returns green when no deadline is provided", () => {
    assert.equal(getSlaStatus(null), "green");
    assert.equal(getSlaStatus(undefined), "green");
  });
});

describe("Edge cases for collection schedule", () => {
  it("handles a schedule with only Sunday windows", () => {
    const sundaySchedule: CollectionSchedule = {
      ...baseSchedule,
      windows: [{ dayOfWeek: 0, startTime: "10:00", endTime: "12:00" }],
    };
    // Monday — next Sunday
    const from = jhbDate(2026, 6, 8, 9, 0); // Monday
    const result = calculateNextCollectionDate(sundaySchedule, from);
    assert.ok(result, "Expected a result");
    assert.equal(result.windowLabel, "Sun 10:00–12:00");
  });

  it("handles multiple windows on the same day", () => {
    const multiWindowSchedule: CollectionSchedule = {
      ...baseSchedule,
      windows: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "11:00" },
        { dayOfWeek: 1, startTime: "14:00", endTime: "16:00" },
      ],
    };
    // Monday 12:00 — first window cutoff (08:00 = 09:00 start - 60min) passed, second window cutoff (13:00 = 14:00 start - 60min) still open
    const from = jhbDate(2026, 6, 8, 12, 0); // Monday
    const result = calculateNextCollectionDate(multiWindowSchedule, from);
    assert.ok(result, "Expected a result");
    assert.equal(result.windowLabel, "Mon 14:00–16:00");
  });
});

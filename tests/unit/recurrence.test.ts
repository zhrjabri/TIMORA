import { describe, expect, it } from "vitest";
import { addDays, addMonths, diffDays, isLocalDate, localDateInTimeZone } from "@/lib/domain/dates";
import { addInterval, defaultDueSoonDays } from "@/lib/domain/recurrence";
import { deriveItemState, type ScheduleInput } from "@/lib/domain/status";

describe("calendar math", () => {
  it("validates local dates strictly", () => {
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
    expect(isLocalDate("1899-12-31")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("clamps month-end dates to the last day of the target month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });

  it("does not accumulate drift because each schedule starts from the anchor", () => {
    // Completed Jan 31 → due Feb 28. If completed again on Feb 28, the next due is Mar 28 (anchor moved).
    expect(addInterval("2026-01-31", 1, "month")).toBe("2026-02-28");
    expect(addInterval("2026-02-28", 1, "month")).toBe("2026-03-28");
    // Two months from the original anchor lands on Mar 31, not Mar 28.
    expect(addInterval("2026-01-31", 2, "month")).toBe("2026-03-31");
  });

  it("handles leap-day yearly recurrence", () => {
    expect(addInterval("2028-02-29", 1, "year")).toBe("2029-02-28");
    expect(addInterval("2028-02-29", 4, "year")).toBe("2032-02-29");
  });

  it("supports every interval unit", () => {
    expect(addInterval("2026-09-15", 10, "day")).toBe("2026-09-25");
    expect(addInterval("2026-09-15", 2, "week")).toBe("2026-09-29");
    expect(addInterval("2026-09-15", 3, "month")).toBe("2026-12-15");
    expect(addInterval("2026-09-15", 2, "year")).toBe("2028-09-15");
  });

  it("measures whole days", () => {
    expect(diffDays("2026-09-15", "2026-09-15")).toBe(0);
    expect(diffDays("2026-09-15", "2026-10-15")).toBe(30);
    expect(diffDays("2026-10-15", "2026-09-15")).toBe(-30);
  });

  it("finds the local date in a timezone", () => {
    const instant = new Date("2026-09-15T22:30:00Z");
    expect(localDateInTimeZone(instant, "UTC")).toBe("2026-09-15");
    expect(localDateInTimeZone(instant, "Asia/Riyadh")).toBe("2026-09-16");
    expect(localDateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-09-15");
  });
});

describe("due soon defaults", () => {
  it("scales with the interval length", () => {
    expect(defaultDueSoonDays({ type: "interval", count: 5, unit: "day" })).toBe(1);
    expect(defaultDueSoonDays({ type: "interval", count: 2, unit: "week" })).toBe(3);
    expect(defaultDueSoonDays({ type: "interval", count: 1, unit: "month" })).toBe(3);
    expect(defaultDueSoonDays({ type: "interval", count: 3, unit: "month" })).toBe(7);
    expect(defaultDueSoonDays({ type: "interval", count: 1, unit: "year" })).toBe(14);
    expect(defaultDueSoonDays({ type: "once", dueDate: "2027-01-01" })).toBe(14);
    expect(defaultDueSoonDays({ type: "none" })).toBeNull();
  });
});

describe("status derivation", () => {
  const base: ScheduleInput = {
    schedule: { type: "interval", count: 3, unit: "month" },
    dueSoonDays: null,
    archived: false,
    scheduleSetAt: "2026-01-01T00:00:00Z",
    lastCompletedOn: "2026-06-15",
    latestRecordedAt: "2026-06-15T08:00:00Z",
  };

  it("is good when the due date is beyond the due-soon window", () => {
    const s = deriveItemState(base, "2026-08-01");
    expect(s).toMatchObject({ status: "good", nextDue: "2026-09-15", daysUntilDue: 45, daysSinceLast: 47, dueSoonDays: 7 });
  });

  it("is due soon inside the window, inclusive of its edge", () => {
    expect(deriveItemState(base, "2026-09-08").status).toBe("due_soon");
    expect(deriveItemState(base, "2026-09-07").status).toBe("good");
  });

  it("is due today on the due date and overdue after it", () => {
    expect(deriveItemState(base, "2026-09-15")).toMatchObject({ status: "due_today", daysUntilDue: 0 });
    expect(deriveItemState(base, "2026-09-18")).toMatchObject({ status: "overdue", daysUntilDue: -3 });
  });

  it("respects a custom due-soon window, including zero", () => {
    expect(deriveItemState({ ...base, dueSoonDays: 30 }, "2026-08-20").status).toBe("due_soon");
    expect(deriveItemState({ ...base, dueSoonDays: 0 }, "2026-09-14").status).toBe("good");
  });

  it("has no schedule when a recurring item was never completed", () => {
    const s = deriveItemState({ ...base, lastCompletedOn: null, latestRecordedAt: null }, "2026-09-15");
    expect(s).toMatchObject({ status: "no_schedule", nextDue: null, daysSinceLast: null });
  });

  it("has no schedule for schedule type none", () => {
    expect(deriveItemState({ ...base, schedule: { type: "none" } }, "2026-09-15").status).toBe("no_schedule");
  });

  it("archived wins over every date-based status", () => {
    expect(deriveItemState({ ...base, archived: true }, "2027-09-18").status).toBe("archived");
  });

  it("tracks one-time dates until completed after the date was set", () => {
    const once: ScheduleInput = {
      ...base,
      schedule: { type: "once", dueDate: "2026-10-01" },
      scheduleSetAt: "2026-09-01T10:00:00Z",
      lastCompletedOn: "2024-10-01",
      latestRecordedAt: "2024-10-01T09:00:00Z",
    };
    expect(deriveItemState(once, "2026-09-20")).toMatchObject({ status: "due_soon", nextDue: "2026-10-01", onceResolved: false });
    expect(deriveItemState(once, "2026-10-03")).toMatchObject({ status: "overdue", daysUntilDue: -2 });

    const done = { ...once, lastCompletedOn: "2026-09-25", latestRecordedAt: "2026-09-25T12:00:00Z" };
    expect(deriveItemState(done, "2026-10-03")).toMatchObject({ status: "no_schedule", nextDue: null, onceResolved: true });
  });
});

import { addDays, addMonths, type LocalDate } from "./dates";

export const SCHEDULE_TYPES = ["interval", "once", "none"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

export const MAX_INTERVAL_COUNT = 1000;
export const MAX_DUE_SOON_DAYS = 365;

export type Schedule =
  | { type: "interval"; count: number; unit: IntervalUnit }
  | { type: "once"; dueDate: LocalDate }
  | { type: "none" };

/** Adds one recurrence period to an anchor date. */
export function addInterval(anchor: LocalDate, count: number, unit: IntervalUnit): LocalDate {
  switch (unit) {
    case "day":
      return addDays(anchor, count);
    case "week":
      return addDays(anchor, count * 7);
    case "month":
      return addMonths(anchor, count);
    case "year":
      return addMonths(anchor, count * 12);
  }
}

/** Approximate interval length in days, used only to pick a sensible "due soon" default. */
export function approximateIntervalDays(count: number, unit: IntervalUnit): number {
  const perUnit = { day: 1, week: 7, month: 30, year: 365 } as const;
  return count * perUnit[unit];
}

/**
 * Default "due soon" window, in days before the due date.
 *   interval ≤ 7 days   → 1 day
 *   interval ≤ 31 days  → 3 days
 *   interval ≤ 183 days → 7 days
 *   longer, or a one-time date → 14 days
 */
export function defaultDueSoonDays(schedule: Schedule): number | null {
  if (schedule.type === "none") return null;
  if (schedule.type === "once") return 14;
  const days = approximateIntervalDays(schedule.count, schedule.unit);
  if (days <= 7) return 1;
  if (days <= 31) return 3;
  if (days <= 183) return 7;
  return 14;
}

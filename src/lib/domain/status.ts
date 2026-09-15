import { diffDays, type LocalDate } from "./dates";
import { addInterval, defaultDueSoonDays, type Schedule } from "./recurrence";

export const ITEM_STATUSES = ["overdue", "due_today", "due_soon", "good", "no_schedule", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type ScheduleInput = {
  schedule: Schedule;
  /** Per-item override; null means use the default for the schedule. */
  dueSoonDays: number | null;
  archived: boolean;
  /** When the schedule was last set or changed (ISO instant). */
  scheduleSetAt: string;
  /** Most recent non-undone completion date, if any. */
  lastCompletedOn: LocalDate | null;
  /** When the most recent non-undone completion was recorded (ISO instant), if any. */
  latestRecordedAt: string | null;
};

export type DerivedState = {
  status: ItemStatus;
  nextDue: LocalDate | null;
  /** Days from today to the due date: negative when overdue. Null when there is no due date. */
  daysUntilDue: number | null;
  /** Days since the last completion, null when never completed. */
  daysSinceLast: number | null;
  dueSoonDays: number | null;
  /** True when a one-time item has been completed since its date was set. */
  onceResolved: boolean;
};

export function resolveNextDue(input: ScheduleInput): { nextDue: LocalDate | null; onceResolved: boolean } {
  const { schedule } = input;
  if (schedule.type === "none") return { nextDue: null, onceResolved: false };
  if (schedule.type === "once") {
    const resolved =
      input.latestRecordedAt !== null &&
      new Date(input.latestRecordedAt).getTime() >= new Date(input.scheduleSetAt).getTime();
    return { nextDue: resolved ? null : schedule.dueDate, onceResolved: resolved };
  }
  // A recurring item without any completion has no anchor yet.
  if (!input.lastCompletedOn) return { nextDue: null, onceResolved: false };
  return { nextDue: addInterval(input.lastCompletedOn, schedule.count, schedule.unit), onceResolved: false };
}

/**
 * Derives the item status from dates. Status is never stored, so it cannot go stale.
 * Precedence: archived → no schedule → overdue → due today → due soon → good.
 */
export function deriveItemState(input: ScheduleInput, today: LocalDate): DerivedState {
  const dueSoonDays = input.dueSoonDays ?? defaultDueSoonDays(input.schedule);
  const { nextDue, onceResolved } = resolveNextDue(input);
  const daysSinceLast = input.lastCompletedOn ? diffDays(input.lastCompletedOn, today) : null;
  const daysUntilDue = nextDue ? diffDays(today, nextDue) : null;

  let status: ItemStatus;
  if (input.archived) status = "archived";
  else if (nextDue === null || daysUntilDue === null) status = "no_schedule";
  else if (daysUntilDue < 0) status = "overdue";
  else if (daysUntilDue === 0) status = "due_today";
  else if (daysUntilDue <= (dueSoonDays ?? 0)) status = "due_soon";
  else status = "good";

  return { status, nextDue, daysUntilDue, daysSinceLast, dueSoonDays, onceResolved };
}

/** Sort weight: what needs attention first. */
export const STATUS_PRIORITY: Record<ItemStatus, number> = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  good: 3,
  no_schedule: 4,
  archived: 5,
};

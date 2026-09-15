import type { ItemOverview } from "@/lib/database.types";
import type { Schedule } from "@/lib/domain/recurrence";
import { deriveItemState, type DerivedState } from "@/lib/domain/status";

export type ItemView = ItemOverview & DerivedState;

export function scheduleOf(row: Pick<ItemOverview, "schedule_type" | "interval_count" | "interval_unit" | "due_date">): Schedule {
  if (row.schedule_type === "interval" && row.interval_count && row.interval_unit) {
    return { type: "interval", count: row.interval_count, unit: row.interval_unit };
  }
  if (row.schedule_type === "once" && row.due_date) {
    return { type: "once", dueDate: row.due_date };
  }
  return { type: "none" };
}

export function toItemView(row: ItemOverview, today: string): ItemView {
  const state = deriveItemState(
    {
      schedule: scheduleOf(row),
      dueSoonDays: row.due_soon_days,
      archived: row.archived_at !== null,
      scheduleSetAt: row.schedule_set_at,
      lastCompletedOn: row.last_completed_on,
      latestRecordedAt: row.latest_recorded_at,
    },
    today,
  );
  return { ...row, ...state };
}

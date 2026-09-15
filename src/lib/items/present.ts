import type { Locale } from "@/i18n/config";
import { fmt, formatLocalDate, plural } from "@/i18n/format";
import type { Messages } from "@/i18n/messages";
import type { ItemStatus } from "@/lib/domain/status";
import type { ItemView } from "./view";
import { itemCategoryName } from "./labels";

/** Serializable item data for client components; all human-readable text is pre-formatted on the server. */
export type ItemCardData = {
  id: string;
  name: string;
  note: string | null;
  icon: string | null;
  status: ItemStatus;
  categoryId: string | null;
  daysUntilDue: number | null;
  lastCompletedOn: string | null;
  createdAt: string;
  archived: boolean;
  text: {
    status: string;
    due: string;
    last: string;
    recurrence: string;
    category: string;
    /** Secondary line: schedule and last completion, or category for date-less items. */
    meta: string;
  };
};

export function recurrenceText(locale: Locale, m: Messages, item: Pick<ItemView, "schedule_type" | "interval_count" | "interval_unit" | "due_date">): string {
  if (item.schedule_type === "interval" && item.interval_count && item.interval_unit) {
    return plural(locale, m.recurrence[item.interval_unit], item.interval_count);
  }
  if (item.schedule_type === "once" && item.due_date) {
    return fmt(m.recurrence.once, { date: formatLocalDate(locale, item.due_date, "medium") });
  }
  return m.recurrence.none;
}

/** The single most useful sentence about when this item is due. */
export function dueText(locale: Locale, m: Messages, item: ItemView): string {
  switch (item.status) {
    case "overdue":
      return plural(locale, m.time.overdueBy, Math.abs(item.daysUntilDue ?? 0));
    case "due_today":
      return m.status.due_today;
    case "due_soon":
    case "good":
      return `${plural(locale, m.time.dueIn, item.daysUntilDue ?? 0)} · ${formatLocalDate(locale, item.nextDue!, "short")}`;
    case "archived":
      return m.status.archived;
    case "no_schedule":
      if (item.onceResolved) return m.item.onceDone;
      if (item.schedule_type === "interval") return m.item.noAnchorHint;
      return lastText(locale, m, item);
  }
}

export function lastText(locale: Locale, m: Messages, item: ItemView): string {
  if (!item.last_completed_on || item.daysSinceLast === null) return `${m.item.lastDone}: ${m.common.never}`;
  const ago = plural(locale, m.time.daysAgo, item.daysSinceLast);
  return `${m.item.lastDone}: ${ago}`;
}

export function toCardData(locale: Locale, m: Messages, item: ItemView): ItemCardData {
  return {
    id: item.id,
    name: item.name,
    note: item.note,
    icon: item.icon ?? item.category_icon,
    status: item.status,
    categoryId: item.category_id,
    daysUntilDue: item.daysUntilDue,
    lastCompletedOn: item.last_completed_on,
    createdAt: item.created_at,
    archived: item.archived_at !== null,
    text: {
      status: m.status[item.status],
      due: dueText(locale, m, item),
      last: lastText(locale, m, item),
      recurrence: recurrenceText(locale, m, item),
      category: itemCategoryName(m, item),
      meta:
        item.schedule_type === "none"
          ? itemCategoryName(m, item)
          : `${recurrenceText(locale, m, item)} · ${lastText(locale, m, item)}`,
    },
  };
}

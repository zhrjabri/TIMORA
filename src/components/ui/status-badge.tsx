import { Archive, CalendarOff, CircleAlert, CircleCheck, Clock3, Hourglass } from "lucide-react";
import type { ItemStatus } from "@/lib/domain/status";

const styles: Record<ItemStatus, { cls: string; Icon: typeof CircleCheck }> = {
  overdue: { cls: "bg-overdue-bg text-overdue", Icon: CircleAlert },
  due_today: { cls: "bg-today-bg text-today", Icon: Clock3 },
  due_soon: { cls: "bg-soon-bg text-soon", Icon: Hourglass },
  good: { cls: "bg-good-bg text-good", Icon: CircleCheck },
  no_schedule: { cls: "bg-neutral-bg text-neutral", Icon: CalendarOff },
  archived: { cls: "bg-neutral-bg text-neutral", Icon: Archive },
};

/** Status is always shown as icon + text so it never depends on colour alone. */
export function StatusBadge({ status, label, size = "md" }: { status: ItemStatus; label: string; size?: "sm" | "md" }) {
  const { cls, Icon } = styles[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${cls} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {label}
    </span>
  );
}

export const STATUS_TEXT_CLASS: Record<ItemStatus, string> = {
  overdue: "text-overdue",
  due_today: "text-today",
  due_soon: "text-soon",
  good: "text-ink-2",
  no_schedule: "text-ink-2",
  archived: "text-ink-2",
};

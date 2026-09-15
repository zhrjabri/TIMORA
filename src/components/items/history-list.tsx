import type { Locale } from "@/i18n/config";
import { fmt, formatInstant, formatLocalDate } from "@/i18n/format";
import { getMessages } from "@/i18n/messages";
import type { CompletionRecord } from "@/lib/database.types";
import { UndoCompletionButton } from "./undo-completion-button";

/** Server-rendered history. Undone records stay visible (audit-friendly) but are clearly marked. */
export function HistoryList({ records, locale, timeZone, compact = false }: { records: CompletionRecord[]; locale: Locale; timeZone: string; compact?: boolean }) {
  const m = getMessages(locale);
  if (records.length === 0) {
    return <p className="text-sm text-ink-2">{m.item.historyEmpty}</p>;
  }
  return (
    <ol className="flex flex-col">
      {records.map((record) => {
        const undone = record.undone_at !== null;
        return (
          <li key={record.id} className="flex items-start gap-3 border-b border-line py-3 last:border-b-0">
            <span aria-hidden className={`mt-2 size-2.5 shrink-0 rotate-45 rounded-[2px] ${undone ? "border border-line-strong" : "bg-accent"}`} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <time dateTime={record.completed_on} className={`font-medium ${undone ? "text-ink-2 line-through decoration-line-strong" : "text-ink"}`}>
                  {formatLocalDate(locale, record.completed_on, "long")}
                </time>
                <span className="text-sm text-ink-2">{m.history.source[record.source]}</span>
                {undone ? <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium text-neutral">{m.history.undone}</span> : null}
              </div>
              {!compact ? (
                <p className="text-sm text-ink-2">
                  {m.history.recordedAt}: {formatInstant(locale, record.recorded_at, timeZone)}
                  {undone ? ` · ${fmt(m.history.undoneAt, { date: formatInstant(locale, record.undone_at!, timeZone) })}` : null}
                </p>
              ) : null}
              {record.note ? <p className="text-sm whitespace-pre-line text-ink">{record.note}</p> : null}
            </div>
            {!compact && !undone ? <UndoCompletionButton recordId={record.id} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

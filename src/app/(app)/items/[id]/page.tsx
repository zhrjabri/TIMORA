import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarPlus, Download, Pencil, Printer, ScanLine } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { fmt, formatLocalDate, plural } from "@/i18n/format";
import { getUserToday } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getItemView, listHistory } from "@/lib/items/queries";
import { itemCategoryName } from "@/lib/items/labels";
import { dueText, recurrenceText } from "@/lib/items/present";
import { defaultDueSoonDays } from "@/lib/domain/recurrence";
import { scheduleOf } from "@/lib/items/view";
import { qrUrl } from "@/lib/qr";
import { uuidSchema } from "@/lib/validation/schemas";
import { StatusBadge, STATUS_TEXT_CLASS } from "@/components/ui/status-badge";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/misc";
import { ItemIcon } from "@/components/items/item-icon";
import { DoneNowButton } from "@/components/items/done-now-button";
import { CustomDateDialog } from "@/components/items/custom-date-dialog";
import { ArchiveButton, DeleteItemButton, RegenerateQrButton } from "@/components/items/item-manage";
import { QrCode } from "@/components/items/qr-code";
import { HistoryList } from "@/components/items/history-list";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return {};
  const item = await getItemView(id);
  return { title: item?.name, robots: { index: false } };
}

export default async function ItemPage({ params, searchParams }: Props) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const [{ locale, dir, m }, { today, timeZone }, item, history, query] = await Promise.all([
    getI18n(),
    getUserToday(),
    getItemView(id),
    listHistory(id, 5),
    searchParams,
  ]);
  if (!item) notFound();

  const env = getEnv();
  const archived = item.archived_at !== null;
  const fromQr = query.from === "qr";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const soonDays = item.due_soon_days ?? defaultDueSoonDays(scheduleOf(item));

  const facts: Array<{ label: string; value: string; sub?: string }> = [
    {
      label: m.item.lastDone,
      value: item.last_completed_on ? formatLocalDate(locale, item.last_completed_on, "long") : m.common.never,
      sub: item.daysSinceLast !== null ? plural(locale, m.time.daysAgo, item.daysSinceLast) : undefined,
    },
    {
      label: m.item.nextDue,
      value: item.nextDue ? formatLocalDate(locale, item.nextDue, "long") : m.common.notSet,
      sub: item.nextDue ? dueText(locale, m, item) : undefined,
    },
    { label: m.item.recurrence, value: recurrenceText(locale, m, item), sub: plural(locale, m.counts.completions, item.completion_count) },
  ];
  if (item.schedule_type !== "none" && soonDays !== null) {
    facts.push({
      label: m.item.dueSoonWindow,
      value: item.due_soon_days !== null ? plural(locale, m.time.daysBefore, soonDays) : fmt(m.item.dueSoonDefault, { value: plural(locale, m.time.daysBefore, soonDays) }),
    });
  }

  const headline =
    item.status === "no_schedule"
      ? item.onceResolved
        ? m.item.onceDone
        : item.schedule_type === "interval"
          ? m.item.noAnchorHint
          : m.item.noScheduleHint
      : dueText(locale, m, item);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/items" className="no-print inline-flex min-h-11 items-center gap-2 self-start rounded-control text-sm text-ink-2 hover:text-ink">
        <BackIcon className="size-4" aria-hidden />
        {m.nav.items}
      </Link>

      {fromQr ? (
        <p className="flex items-center gap-2 rounded-control bg-surface-muted px-4 py-3 text-sm text-ink" role="status">
          <ScanLine className="size-4.5 shrink-0" aria-hidden />
          {m.item.scanned}
        </p>
      ) : null}

      {archived ? (
        <p className="rounded-control border border-line bg-neutral-bg px-4 py-3 text-sm text-neutral" role="status">
          {m.item.archivedNotice}
        </p>
      ) : null}

      <header className="flex items-start gap-4">
        <ItemIcon icon={item.icon ?? item.category_icon} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-ink-2">{itemCategoryName(m, item)}</p>
          <h1 dir="auto" className="font-display text-2xl leading-tight font-semibold break-words text-ink sm:text-3xl">{item.name}</h1>
          <div>
            <StatusBadge status={item.status} label={m.status[item.status]} />
          </div>
        </div>
        <LinkButton href={`/items/${item.id}/edit`} variant="ghost" className="no-print shrink-0" icon={<Pencil className="size-4.5" aria-hidden />}>
          <span className="sr-only sm:not-sr-only">{m.common.edit}</span>
        </LinkButton>
      </header>

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <p className={`font-display text-xl font-semibold sm:text-2xl ${STATUS_TEXT_CLASS[item.status]}`}>{headline}</p>
        {!archived ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <DoneNowButton itemId={item.id} itemName={item.name} source={fromQr ? "qr" : "done_now"} size="lg" className="sm:min-w-44" />
            <CustomDateDialog itemId={item.id} itemName={item.name} today={today} />
          </div>
        ) : null}
        <dl className="grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-2">{fact.label}</dt>
              <dd className="font-medium text-ink">{fact.value}</dd>
              {fact.sub ? <dd className="text-sm text-ink-2">{fact.sub}</dd> : null}
            </div>
          ))}
        </dl>
        {item.note ? (
          <div className="flex flex-col gap-1 border-t border-line pt-5">
            <h2 className="text-sm text-ink-2">{m.item.notes}</h2>
            <p dir="auto" className="whitespace-pre-line text-ink">{item.note}</p>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card as="section" className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-ink">{m.item.history}</h2>
            {item.completion_count > 0 || history.length > 0 ? (
              <Link href={`/items/${item.id}/history`} className="rounded-sm text-sm font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
                {m.item.historyAll}
              </Link>
            ) : null}
          </div>
          <HistoryList records={history} locale={locale} timeZone={timeZone} compact />
        </Card>

        <div className="flex flex-col gap-6">
          <Card as="section" className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">{m.item.calendarTitle}</h2>
            {item.nextDue && !archived ? (
              <>
                <p className="text-sm text-ink-2">{m.item.calendarBody}</p>
                <a href={`/api/items/${item.id}/calendar`} className={buttonClasses("secondary", "md", "self-start")} download>
                  <CalendarPlus className="size-4.5" aria-hidden />
                  {m.item.calendarAction}
                </a>
              </>
            ) : (
              <p className="text-sm text-ink-2">{m.item.calendarUnavailable}</p>
            )}
          </Card>

          <Card as="section" className="flex flex-col gap-4 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">{m.item.qrTitle}</h2>
            <div className="flex items-start gap-4">
              <QrCode value={qrUrl(env.NEXT_PUBLIC_SITE_URL, item.qr_token)} label={fmt(m.item.qrImageAlt, { name: item.name })} className="size-28 shrink-0 rounded-lg border border-line" />
              <p className="text-sm text-ink-2">{m.item.qrBody}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/items/${item.id}/label`} className={buttonClasses("secondary", "md")}>
                <Printer className="size-4.5" aria-hidden />
                {m.item.qrPrint}
              </Link>
              <a href={`/api/items/${item.id}/qr?format=png`} className={buttonClasses("ghost", "md")} download>
                <Download className="size-4.5" aria-hidden />
                PNG
              </a>
              <a href={`/api/items/${item.id}/qr?format=svg`} className={buttonClasses("ghost", "md")} download>
                <Download className="size-4.5" aria-hidden />
                SVG
              </a>
            </div>
            <div className="border-t border-line pt-3">
              <RegenerateQrButton itemId={item.id} />
            </div>
          </Card>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 border-t border-line pt-6">
        <ArchiveButton itemId={item.id} archived={archived} />
        <DeleteItemButton itemId={item.id} itemName={item.name} />
      </div>
    </div>
  );
}

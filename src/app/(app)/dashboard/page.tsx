import Link from "next/link";
import type { Metadata } from "next";
import { CircleCheck, Plus } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { formatLocalDate, plural } from "@/i18n/format";
import { getProfile, getUserToday } from "@/lib/auth";
import { listCategories, listItemViews, listRecentCompletions } from "@/lib/items/queries";
import { categoryName } from "@/lib/items/labels";
import { toCardData, type ItemCardData } from "@/lib/items/present";
import { sortItems } from "@/lib/items/browse";
import { LinkButton } from "@/components/ui/button";
import { Section } from "@/components/ui/misc";
import { ItemCard } from "@/components/items/item-card";
import { ItemIcon } from "@/components/items/item-icon";
import { ItemsBrowser } from "@/components/items/items-browser";
import { Mark } from "@/components/brand/logo";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.dashboard.title };
}

export default async function DashboardPage() {
  const [{ locale, m }, items, categories, recent, profile, { today: todayDate }] = await Promise.all([
    getI18n(),
    listItemViews(),
    listCategories(),
    listRecentCompletions(),
    getProfile(),
    getUserToday(),
  ]);

  const cards = items.map((item) => toCardData(locale, m, item));
  const active = cards.filter((c) => !c.archived);

  if (active.length === 0 && cards.length === 0) {
    return <EmptyDashboard />;
  }

  const byStatus = (status: ItemCardData["status"]) => sortItems(active.filter((c) => c.status === status), "next_due", locale);
  const overdue = byStatus("overdue");
  const today = byStatus("due_today");
  const soon = byStatus("due_soon");
  const attention = [...overdue, ...today, ...soon];

  const names = new Map(items.map((i) => [i.id, { name: i.name, icon: i.icon ?? i.category_icon }]));
  const categoryOptions = categories.map((c) => ({ id: c.id, label: categoryName(m, c) }));

  const counters = [
    { key: "overdue", label: m.dashboard.overdue, count: overdue.length, tone: "text-overdue" },
    { key: "due_today", label: m.dashboard.dueToday, count: today.length, tone: "text-today" },
    { key: "due_soon", label: m.dashboard.dueSoon, count: soon.length, tone: "text-soon" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-ink-2">{formatLocalDate(locale, todayDate, "weekday")}</p>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-[1.75rem]">
              {profile?.display_name ? `${m.dashboard.title} · ${profile.display_name}` : m.dashboard.title}
            </h1>
          </div>
          <p className="hidden text-sm text-ink-2 sm:block">{plural(locale, m.counts.items, active.length)}</p>
        </div>

        <nav aria-label={m.dashboard.summaryLabel}>
          <ul className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-card border border-line bg-surface">
            {counters.map((c) => (
              <li key={c.key}>
                <Link
                  href={`/items?status=${c.key}`}
                  className="flex min-h-18 flex-col items-center justify-center gap-0.5 px-2 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span className={`tabular font-display text-2xl font-semibold leading-none ${c.count > 0 ? c.tone : "text-ink-3"}`}>{c.count}</span>
                  <span className="text-sm text-ink-2">{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Section id="attention" title={m.dashboard.attentionTitle}>
        {attention.length === 0 ? (
          <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-good-bg text-good">
              <CircleCheck className="size-5.5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-ink">{m.dashboard.allClearTitle}</p>
              <p className="text-sm text-ink-2">{m.dashboard.allClearBody}</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {attention.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} emphasis={item.status !== "due_soon"} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="recent" title={m.dashboard.recentTitle}>
        {recent.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong/50 px-5 py-4 text-sm text-ink-2">{m.dashboard.recentEmpty}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {recent.map((record) => {
              const item = names.get(record.item_id);
              if (!item) return null;
              return (
                <li key={record.id}>
                  <Link href={`/items/${record.item_id}`} className="flex min-h-15 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted">
                    <ItemIcon icon={item.icon} size="sm" />
                    <span dir="auto" className="min-w-0 flex-1 truncate text-start font-medium text-ink">{item.name}</span>
                    <span className="shrink-0 text-sm text-ink-2">
                      <time dateTime={record.completed_on}>{formatLocalDate(locale, record.completed_on, "short")}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="all" title={m.dashboard.allItemsTitle} action={<Link href="/items" className="rounded-sm text-sm font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">{m.dashboard.viewAll}</Link>}>
        <ItemsBrowser items={cards} categories={categoryOptions} headingId="all" />
      </Section>
    </div>
  );
}

async function EmptyDashboard() {
  const { m } = await getI18n();
  const ideas = m.landing.examples.slice(0, 6);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-6 text-center sm:py-12">
      <span className="grid size-20 place-items-center rounded-3xl bg-brand-black text-brand-ivory shadow-raise">
        <Mark variant="compact" className="size-12" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">{m.dashboard.emptyTitle}</h1>
        <p className="text-ink-2">{m.dashboard.emptyBody}</p>
      </div>
      <LinkButton href="/items/new" size="lg" icon={<Plus className="size-5" aria-hidden />}>
        {m.dashboard.emptyCta}
      </LinkButton>
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-ink-2">{m.dashboard.emptyIdeas}</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {ideas.map((idea) => (
            <li key={idea}>
              <Link
                href={`/items/new?name=${encodeURIComponent(idea)}`}
                className="inline-flex min-h-10 items-center rounded-full border border-line-strong/50 bg-surface px-4 text-sm text-ink transition-colors hover:bg-surface-muted"
              >
                {idea}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

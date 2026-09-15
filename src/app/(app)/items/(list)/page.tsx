import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { plural } from "@/i18n/format";
import { listCategories, listItemViews } from "@/lib/items/queries";
import { categoryName } from "@/lib/items/labels";
import { toCardData } from "@/lib/items/present";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ItemsBrowser } from "@/components/items/items-browser";
import { Mark } from "@/components/brand/logo";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.nav.items };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.slice(0, 100);

export default async function ItemsPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ locale, m }, items, categories, params] = await Promise.all([getI18n(), listItemViews(), listCategories(), searchParams]);
  const cards = items.map((item) => toCardData(locale, m, item));
  const activeCount = cards.filter((c) => !c.archived).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={m.nav.items}
        description={plural(locale, m.counts.items, activeCount)}
        actions={
          <LinkButton href="/items/new" icon={<Plus className="size-4.5" aria-hidden />} className="max-md:hidden">
            {m.form.createTitle}
          </LinkButton>
        }
      />
      {cards.length === 0 ? (
        <EmptyState
          icon={<Mark variant="compact" className="size-9" />}
          title={m.dashboard.emptyTitle}
          body={m.dashboard.emptyBody}
          action={
            <LinkButton href="/items/new" icon={<Plus className="size-4.5" aria-hidden />}>
              {m.dashboard.emptyCta}
            </LinkButton>
          }
        />
      ) : (
        <ItemsBrowser
          items={cards}
          categories={categories.map((c) => ({ id: c.id, label: categoryName(m, c) }))}
          initial={{ q: first(params.q), category: first(params.category), status: first(params.status), sort: first(params.sort) }}
          syncUrl
        />
      )}
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/domain/status";
import { filterItems, SORT_KEYS, sortItems, type SortKey } from "@/lib/items/browse";
import type { ItemCardData } from "@/lib/items/present";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ItemCard } from "./item-card";

type Props = {
  items: ItemCardData[];
  categories: Array<{ id: string; label: string }>;
  initial?: { q?: string; category?: string; status?: string; sort?: string };
  /** Keep filters in the URL (All items page) or only in local state (dashboard). */
  syncUrl?: boolean;
  headingId?: string;
};

export function ItemsBrowser({ items, categories, initial = {}, syncUrl = false, headingId }: Props) {
  const { m, locale, plural } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  const [q, setQ] = useState(initial.q ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [status, setStatus] = useState<ItemStatus | "">(
    (ITEM_STATUSES as readonly string[]).includes(initial.status ?? "") ? (initial.status as ItemStatus) : "",
  );
  const [sort, setSort] = useState<SortKey>((SORT_KEYS as readonly string[]).includes(initial.sort ?? "") ? (initial.sort as SortKey) : "attention");
  const deferredQ = useDeferredValue(q);

  const update = (next: { q?: string; category?: string; status?: string; sort?: string }) => {
    if (!syncUrl) return;
    const params = new URLSearchParams();
    const merged = { q, category, status, sort, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.status) params.set("status", merged.status);
    if (merged.sort && merged.sort !== "attention") params.set("sort", merged.sort);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const visible = useMemo(
    () => sortItems(filterItems(items, { q: deferredQ, category, status }), sort, locale),
    [items, deferredQ, status, category, sort, locale],
  );

  const filtersActive = Boolean(q || category || status);

  return (
    <div className="flex flex-col gap-4">
      <div role="search" className="grid grid-cols-2 gap-2.5 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative col-span-2 md:col-span-1">
          <label htmlFor="items-search" className="sr-only">
            {m.list.searchLabel}
          </label>
          <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-2" aria-hidden />
          <Input
            id="items-search"
            type="search"
            value={q}
            placeholder={m.list.searchPlaceholder}
            className="ps-10"
            autoComplete="off"
            enterKeyHint="search"
            onChange={(e) => {
              setQ(e.target.value);
              update({ q: e.target.value });
            }}
          />
        </div>
        <div>
          <label htmlFor="items-category" className="sr-only">
            {m.list.categoryLabel}
          </label>
          <Select
            id="items-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              update({ category: e.target.value });
            }}
          >
            <option value="">{m.list.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            <option value="none">{m.categories.uncategorized}</option>
          </Select>
        </div>
        <div>
          <label htmlFor="items-status" className="sr-only">
            {m.list.statusLabel}
          </label>
          <Select
            id="items-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ItemStatus | "");
              update({ status: e.target.value });
            }}
          >
            <option value="">{m.list.allStatuses}</option>
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {m.status[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="items-sort" className="sr-only">
            {m.list.sortLabel}
          </label>
          <Select
            id="items-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              update({ sort: e.target.value });
            }}
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {m.list.sortLabel}: {m.list.sort[key]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-sm text-ink-2" aria-live="polite" id={headingId ? `${headingId}-count` : undefined}>
          {plural(m.list.results, visible.length)}
        </p>
        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setCategory("");
              setStatus("");
              update({ q: "", category: "", status: "" });
            }}
          >
            {m.list.clearFilters}
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong/50 px-6 py-10 text-center">
          <SearchX className="size-7 text-ink-2" aria-hidden />
          <p className="font-medium text-ink">{m.list.noResultsTitle}</p>
          <p className="text-sm text-ink-2">{m.list.noResultsBody}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visible.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { STATUS_PRIORITY, type ItemStatus } from "@/lib/domain/status";

export const SORT_KEYS = ["attention", "next_due", "name", "recent", "created"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type BrowseFilters = {
  q?: string;
  /** Category id, "none" for uncategorized, or empty for all. */
  category?: string;
  /** Empty shows everything except archived items. */
  status?: ItemStatus | "";
};

export type Browsable = {
  name: string;
  note: string | null;
  status: ItemStatus;
  categoryId: string | null;
  daysUntilDue: number | null;
  lastCompletedOn: string | null;
  createdAt: string;
  text: { category: string };
};

/** Normalises Arabic and Latin text for forgiving search (diacritics, alef/yaa/taa marbuta forms, case). */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function filterItems<T extends Browsable>(items: T[], filters: BrowseFilters): T[] {
  const needle = filters.q ? normalizeSearch(filters.q) : "";
  return items.filter((item) => {
    if (filters.status ? item.status !== filters.status : item.status === "archived") return false;
    if (filters.category && (filters.category === "none" ? item.categoryId !== null : item.categoryId !== filters.category)) return false;
    if (needle && !normalizeSearch(`${item.name} ${item.note ?? ""} ${item.text.category}`).includes(needle)) return false;
    return true;
  });
}

export function sortItems<T extends Browsable>(items: T[], sort: SortKey, locale: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const due = (i: T) => i.daysUntilDue ?? Number.POSITIVE_INFINITY;
  const byName = (a: T, b: T) => collator.compare(a.name, b.name);
  const copy = [...items];
  switch (sort) {
    case "attention":
      return copy.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || due(a) - due(b) || byName(a, b));
    case "next_due":
      return copy.sort((a, b) => due(a) - due(b) || byName(a, b));
    case "name":
      return copy.sort(byName);
    case "recent":
      return copy.sort((a, b) => (b.lastCompletedOn ?? "").localeCompare(a.lastCompletedOn ?? "") || byName(a, b));
    case "created":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

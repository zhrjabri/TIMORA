import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { plural } from "@/i18n/format";
import { listCategories, listItemViews } from "@/lib/items/queries";
import { categoryName } from "@/lib/items/labels";
import { PageHeader } from "@/components/ui/misc";
import { CategoryManager } from "@/components/categories/category-manager";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.categories.title };
}

export default async function CategoriesPage() {
  const [{ locale, m }, categories, items] = await Promise.all([getI18n(), listCategories(), listItemViews()]);
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.category_id && !item.archived_at) counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={m.categories.title} description={m.categories.intro} />
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          label: categoryName(m, c),
          name: c.name,
          icon: c.icon,
          starter: c.system_key !== null,
          itemCount: plural(locale, m.counts.items, counts.get(c.id) ?? 0),
        }))}
      />
    </div>
  );
}

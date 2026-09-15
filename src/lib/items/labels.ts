import type { Category } from "@/lib/database.types";
import type { Messages } from "@/i18n/messages";
import type { ItemView } from "./view";

type CategoryLike = { name: string | null; system_key: Category["system_key"] };

export function categoryName(m: Messages, category: CategoryLike | null | undefined): string {
  if (!category) return m.categories.uncategorized;
  if (category.name) return category.name;
  if (category.system_key) return m.categories.system[category.system_key];
  return m.categories.uncategorized;
}

export function itemCategoryName(m: Messages, item: Pick<ItemView, "category_name" | "category_system_key" | "category_id">): string {
  if (!item.category_id) return m.categories.uncategorized;
  return categoryName(m, { name: item.category_name, system_key: item.category_system_key });
}

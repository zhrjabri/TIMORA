import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { getUserToday } from "@/lib/auth";
import { listCategories } from "@/lib/items/queries";
import { categoryName } from "@/lib/items/labels";
import { PageHeader } from "@/components/ui/misc";
import { ItemForm } from "@/components/items/item-form";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.form.createTitle };
}

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ name?: string | string[] }> }) {
  const [{ m }, { today }, categories, params] = await Promise.all([getI18n(), getUserToday(), listCategories(), searchParams]);
  const suggestedName = (Array.isArray(params.name) ? params.name[0] : params.name)?.trim().slice(0, 80) ?? "";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={m.form.createTitle} />
      <ItemForm
        mode="create"
        today={today}
        categories={categories.map((c) => ({ id: c.id, label: categoryName(m, c) }))}
        defaultValues={{
          name: suggestedName,
          categoryId: "",
          icon: "",
          scheduleType: "interval",
          intervalCount: "3",
          intervalUnit: "month",
          dueDate: "",
          lastCompletedOn: today,
          dueSoonDays: "",
          note: "",
        }}
      />
    </div>
  );
}

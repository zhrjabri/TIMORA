import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { getUserToday } from "@/lib/auth";
import { getItemView, listCategories } from "@/lib/items/queries";
import { categoryName } from "@/lib/items/labels";
import { uuidSchema } from "@/lib/validation/schemas";
import { PageHeader } from "@/components/ui/misc";
import { ItemForm } from "@/components/items/item-form";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.form.editTitle };
}

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [{ m }, { today }, item, categories] = await Promise.all([getI18n(), getUserToday(), getItemView(id), listCategories()]);
  if (!item) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={m.form.editTitle} eyebrow={item.name} />
      <ItemForm
        mode="edit"
        itemId={item.id}
        today={today}
        categories={categories.map((c) => ({ id: c.id, label: categoryName(m, c) }))}
        defaultValues={{
          name: item.name,
          categoryId: item.category_id ?? "",
          icon: item.icon ?? "",
          scheduleType: item.schedule_type,
          intervalCount: item.interval_count ? String(item.interval_count) : "3",
          intervalUnit: item.interval_unit ?? "month",
          dueDate: item.due_date ?? "",
          lastCompletedOn: "",
          dueSoonDays: item.due_soon_days !== null ? String(item.due_soon_days) : "",
          note: item.note ?? "",
        }}
      />
    </div>
  );
}

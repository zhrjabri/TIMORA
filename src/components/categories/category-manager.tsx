"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "@/app/actions/categories";
import { useI18n } from "@/i18n/provider";
import { ICON_KEYS } from "@/lib/icons";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useActionFeedback } from "@/components/items/use-action-feedback";

export type CategoryRowData = { id: string; label: string; name: string | null; icon: string | null; starter: boolean; itemCount: string };

function CategoryEditor({
  initialName,
  initialIcon,
  submitLabel,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  initialName: string;
  initialIcon: string;
  submitLabel: string;
  onSubmit: (values: { name: string; icon: string }) => Promise<boolean>;
  onCancel?: () => void;
  idPrefix: string;
}) {
  const { m, fmt } = useI18n();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return setError(m.validation.required);
        if (trimmed.length > 40) return setError(fmt(m.validation.tooLong, { max: 40 }));
        setError(undefined);
        startTransition(async () => {
          const okResult = await onSubmit({ name: trimmed, icon });
          if (okResult && !onCancel) setName("");
        });
      }}
    >
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor={`${idPrefix}-name`} className="sr-only">
          {m.categories.newName}
        </label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          maxLength={40}
          placeholder={m.categories.newName}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${idPrefix}-error` : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {error ? (
          <p id={`${idPrefix}-error`} role="alert" className="text-sm text-overdue">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <div className="w-40">
          <label htmlFor={`${idPrefix}-icon`} className="sr-only">
            {m.categories.icon}
          </label>
          <div className="relative">
            <AppIcon iconKey={icon || null} className="pointer-events-none absolute start-3 top-1/2 z-10 size-4.5 -translate-y-1/2 text-ink-2" aria-hidden />
            <Select id={`${idPrefix}-icon`} value={icon} className="ps-9" onChange={(e) => setIcon(e.target.value)}>
              <option value="">{m.form.iconNone}</option>
              {ICON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {m.icons.names[key]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Button type="submit" loading={pending} icon={onCancel ? <Check className="size-4.5" aria-hidden /> : <Plus className="size-4.5" aria-hidden />}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} aria-label={m.common.cancel}>
            <X className="size-4.5" aria-hidden />
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRowData[] }) {
  const { m, fmt } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="add-category" className="rounded-card border border-line bg-surface p-5">
        <h2 id="add-category" className="mb-3 font-display text-lg font-semibold text-ink">
          {m.categories.add}
        </h2>
        <CategoryEditor
          idPrefix="new-category"
          initialName=""
          initialIcon=""
          submitLabel={m.categories.add}
          onSubmit={async (values) => {
            const result = await createCategoryAction(values);
            if (!result.ok) {
              showError(result.error);
              return false;
            }
            toast.success(m.categories.created);
            router.refresh();
            return true;
          }}
        />
      </section>

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {categories.map((category) => {
          return (
            <li key={category.id} className="px-4 py-3">
              {editing === category.id ? (
                <CategoryEditor
                  idPrefix={`edit-${category.id}`}
                  initialName={category.label}
                  initialIcon={category.icon ?? ""}
                  submitLabel={m.common.save}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (values) => {
                    const result = await updateCategoryAction(category.id, values);
                    if (!result.ok) {
                      showError(result.error);
                      return false;
                    }
                    toast.success(m.categories.updated);
                    setEditing(null);
                    router.refresh();
                    return true;
                  }}
                />
              ) : (
                <div className="flex min-h-12 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink" aria-hidden>
                    <AppIcon iconKey={category.icon} className="size-5" strokeWidth={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-ink">{category.label}</span>
                    <span className="text-sm text-ink-2">
                      {category.itemCount}
                      {category.starter ? ` · ${m.categories.starter}` : null}
                    </span>
                  </div>
                  <Button variant="ghost" size="md" onClick={() => setEditing(category.id)} icon={<Pencil className="size-4" aria-hidden />}>
                    <span className="sr-only sm:not-sr-only">{m.categories.rename}</span>
                    <span className="sr-only">{category.label}</span>
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="quiet-danger" size="md" icon={<Trash2 className="size-4" aria-hidden />}>
                        <span className="sr-only">
                          {m.common.delete} {category.label}
                        </span>
                      </Button>
                    }
                    title={fmt(m.categories.deleteTitle, { name: category.label })}
                    description={m.categories.deleteBody}
                    confirmLabel={m.common.delete}
                    cancelLabel={m.common.cancel}
                    onConfirm={async () => {
                      const result = await deleteCategoryAction(category.id);
                      if (!result.ok) {
                        showError(result.error);
                        return false;
                      }
                      toast.success(m.categories.deleted);
                      router.refresh();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

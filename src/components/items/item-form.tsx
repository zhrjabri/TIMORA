"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarClock, CalendarOff, Repeat } from "lucide-react";
import { createItemAction, updateItemAction } from "@/app/actions/items";
import { useI18n } from "@/i18n/provider";
import { itemFormSchema, type ItemFormValues } from "@/lib/validation/schemas";
import { addInterval, defaultDueSoonDays, INTERVAL_UNITS, type Schedule } from "@/lib/domain/recurrence";
import { isLocalDate } from "@/lib/domain/dates";
import { ICON_KEYS, ICONS } from "@/lib/icons";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useActionFeedback } from "./use-action-feedback";

type Props = {
  mode: "create" | "edit";
  itemId?: string;
  today: string;
  defaultValues: ItemFormValues;
  categories: Array<{ id: string; label: string }>;
};

const TYPE_ICONS = { interval: Repeat, once: CalendarClock, none: CalendarOff } as const;

export function ItemForm({ mode, itemId, today, defaultValues, categories }: Props) {
  const { m, plural, fmt, date } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [showAllIcons, setShowAllIcons] = useState(
    () => Boolean(defaultValues.icon) && !ICON_KEYS.slice(0, 18).includes(defaultValues.icon as (typeof ICON_KEYS)[number]),
  );

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema(today)) as unknown as Resolver<ItemFormValues>,
    defaultValues,
    mode: "onBlur",
  });

  const values = useWatch({ control });
  const scheduleType = values.scheduleType ?? "interval";

  const errorText = (field: keyof ItemFormValues) => {
    const code = errors[field]?.message as keyof typeof m.validation | undefined;
    if (!code) return undefined;
    const template = m.validation[code] ?? m.common.genericError;
    return fmt(template, { max: field === "note" ? 1000 : 80 });
  };

  // Live explanation of what will happen, so the rule is understandable before saving.
  const count = Number(values.intervalCount);
  const schedule: Schedule =
    scheduleType === "interval" && Number.isInteger(count) && count >= 1 && count <= 1000
      ? { type: "interval", count, unit: values.intervalUnit ?? "month" }
      : scheduleType === "once" && values.dueDate && isLocalDate(values.dueDate)
        ? { type: "once", dueDate: values.dueDate }
        : { type: "none" };
  const defaultSoon = defaultDueSoonDays(schedule);
  const lastDone = values.lastCompletedOn && isLocalDate(values.lastCompletedOn) ? values.lastCompletedOn : null;
  let preview: string | null = null;
  if (schedule.type === "interval") {
    preview = lastDone ? fmt(m.form.previewNext, { date: date(addInterval(lastDone, schedule.count, schedule.unit), "long") }) : m.form.previewNone;
  } else if (schedule.type === "once") {
    preview = fmt(m.form.previewNext, { date: date(schedule.dueDate, "long") });
  }

  const onSubmit = handleSubmit(async (data) => {
    const result = mode === "create" ? await createItemAction(data) : await updateItemAction(itemId!, data);
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, code] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ItemFormValues, { message: code });
        }
      }
      if (result.error !== "invalid") showError(result.error);
      return;
    }
    toast.success(mode === "create" ? m.toast.created : m.toast.saved);
    router.push(`/items/${result.data.id}`);
    router.refresh();
  });

  const visibleIcons = showAllIcons ? ICON_KEYS : ICON_KEYS.slice(0, 18);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:p-6">
        <legend className="px-1 font-display text-lg font-semibold text-ink">{m.form.basics}</legend>

        <Field label={m.form.name} error={errorText("name")}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              autoFocus={mode === "create"}
              autoComplete="off"
              maxLength={80}
              placeholder={m.form.namePlaceholder}
              {...register("name")}
            />
          )}
        </Field>

        <Field label={m.form.category} optionalLabel={m.common.optional}>
          {({ id }) => (
            <Select id={id} {...register("categoryId")}>
              <option value="">{m.categories.uncategorized}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">
            {m.form.icon} <span className="text-xs font-normal text-ink-3">({m.common.optional})</span>
          </legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-9">
            <label className="relative">
              <input type="radio" value="" className="peer sr-only" {...register("icon")} />
              <span className="grid aspect-square min-h-11 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-xs text-ink-2 transition-colors peer-checked:border-ink peer-checked:bg-surface-muted peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                —
              </span>
              <span className="sr-only">{m.form.iconNone}</span>
            </label>
            {visibleIcons.map((key) => {
              const Icon = ICONS[key];
              return (
                <label key={key} className="relative" title={m.icons.names[key]}>
                  <input type="radio" value={key} className="peer sr-only" aria-label={m.icons.names[key]} {...register("icon")} />
                  <span className="grid aspect-square min-h-11 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-ink-2 transition-colors peer-checked:border-ink peer-checked:bg-surface-muted peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                </label>
              );
            })}
          </div>
          {!showAllIcons ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAllIcons(true)}>
              +{ICON_KEYS.length - 18}
            </Button>
          ) : null}
        </fieldset>
      </fieldset>

      <fieldset className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:p-6">
        <legend className="px-1 font-display text-lg font-semibold text-ink">{m.form.schedule}</legend>

        <div role="radiogroup" aria-label={m.form.scheduleType} className="grid gap-2 sm:grid-cols-3">
          {(["interval", "once", "none"] as const).map((type) => {
            const Icon = TYPE_ICONS[type];
            return (
              <label key={type} className="relative">
                <input type="radio" value={type} className="peer sr-only" {...register("scheduleType")} />
                <span className="flex h-full cursor-pointer items-start gap-3 rounded-control border border-line p-3.5 transition-colors peer-checked:border-ink peer-checked:bg-surface-muted peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus hover:border-line-strong">
                  <Icon className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden strokeWidth={1.75} />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-ink">{m.form.types[type].label}</span>
                    <span className="text-sm leading-snug text-ink-2">{m.form.types[type].hint}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {scheduleType === "interval" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink" id="interval-label">
              {m.form.every}
            </span>
            <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2" role="group" aria-labelledby="interval-label">
              <div>
                <label htmlFor="intervalCount" className="sr-only">
                  {m.form.intervalCount}
                </label>
                <Input
                  id="intervalCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  className="tabular"
                  aria-invalid={Boolean(errors.intervalCount)}
                  aria-describedby={errors.intervalCount ? "intervalCount-error" : undefined}
                  {...register("intervalCount")}
                />
              </div>
              <div>
                <label htmlFor="intervalUnit" className="sr-only">
                  {m.form.intervalUnit}
                </label>
                <Select id="intervalUnit" {...register("intervalUnit")}>
                  {INTERVAL_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {m.recurrence.units[unit]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {errors.intervalCount ? (
              <p id="intervalCount-error" role="alert" className="text-sm text-overdue">
                {errorText("intervalCount")}
              </p>
            ) : null}
          </div>
        ) : null}

        {scheduleType === "once" ? (
          <Field label={m.form.dueDate} error={errorText("dueDate")}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="date" min="1900-01-01" aria-describedby={describedBy} aria-invalid={invalid} {...register("dueDate")} />
            )}
          </Field>
        ) : null}

        {mode === "create" ? (
          <Field label={m.form.lastDone} optionalLabel={m.common.optional} hint={m.form.lastDoneHint} error={errorText("lastCompletedOn")}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="date" max={today} min="1900-01-01" aria-describedby={describedBy} aria-invalid={invalid} {...register("lastCompletedOn")} />
            )}
          </Field>
        ) : null}

        {scheduleType !== "none" ? (
          <Field
            label={m.form.dueSoon}
            optionalLabel={m.common.optional}
            hint={defaultSoon !== null ? fmt(m.form.dueSoonHint, { value: plural(m.time.days, defaultSoon) }) : undefined}
            error={errorText("dueSoonDays")}
          >
            {({ id, describedBy, invalid }) => (
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={365}
                  placeholder={defaultSoon !== null ? String(defaultSoon) : undefined}
                  className="tabular max-w-28"
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  {...register("dueSoonDays")}
                />
                <span className="text-ink-2">{m.form.dueSoonUnit}</span>
              </div>
            )}
          </Field>
        ) : null}

        {preview ? (
          <p className="rounded-control bg-surface-muted px-4 py-3 text-sm text-ink" aria-live="polite">
            <span className="font-medium">{m.form.preview}: </span>
            <span suppressHydrationWarning>{preview}</span>
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5 sm:p-6">
        <Field label={m.form.note} optionalLabel={m.common.optional} error={errorText("note")}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} rows={3} maxLength={1000} placeholder={m.form.notePlaceholder} aria-describedby={describedBy} aria-invalid={invalid} {...register("note")} />
          )}
        </Field>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="lg" onClick={() => router.back()} disabled={isSubmitting}>
          {m.common.cancel}
        </Button>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {mode === "create" ? m.form.createAction : m.form.saveAction}
        </Button>
      </div>
    </form>
  );
}

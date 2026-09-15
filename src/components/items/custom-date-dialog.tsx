"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import { CalendarDays, X } from "lucide-react";
import { completeItemAction, undoCompletionAction } from "@/app/actions/items";
import { useI18n } from "@/i18n/provider";
import { isLocalDate } from "@/lib/domain/dates";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useActionFeedback } from "./use-action-feedback";

export function CustomDateDialog({ itemId, itemName, today, className = "" }: { itemId: string; itemName: string; today: string; className?: string }) {
  const { m, fmt, date: formatDate } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isLocalDate(value)) return setError(m.validation.invalidDate);
    if (value > today) return setError(m.validation.futureDate);
    setError(undefined);
    setPending(true);
    const result = await completeItemAction({ itemId, completedOn: value, note, source: "backdated" });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors?.completedOn) setError(m.validation.futureDate);
      else showError(result.error);
      return;
    }
    setOpen(false);
    setNote("");
    const { recordId, nextDue } = result.data;
    toast.success(m.toast.done, {
      description: `${itemName} · ${nextDue ? fmt(m.toast.doneNext, { date: formatDate(nextDue, "medium") }) : m.toast.doneNoNext}`,
      duration: 8000,
      action: {
        label: m.common.undo,
        onClick: async () => {
          const undo = await undoCompletionAction(recordId);
          if (undo.ok) {
            toast.success(m.toast.undone);
            router.refresh();
          } else showError(undo.error);
        },
      },
    });
    router.refresh();
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="lg" className={className} icon={<CalendarDays className="size-5" aria-hidden />}>
          {m.item.doneAnotherDay}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-card border border-line bg-surface p-6 shadow-float focus:outline-none sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 data-[state=open]:animate-[rise-in_180ms_var(--ease-out-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-lg font-semibold text-ink">{m.item.customDateTitle}</Dialog.Title>
              <Dialog.Description className="mt-1 text-ink-2">{itemName}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={m.common.close} className="-m-2 grid size-11 cursor-pointer place-items-center rounded-control text-ink-2 hover:bg-surface-muted">
                <X className="size-5" aria-hidden />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
            <Field label={m.item.customDateLabel} error={error}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} type="date" required max={today} min="1900-01-01" value={value} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setValue(e.target.value)} />
              )}
            </Field>
            <Field label={m.item.customNoteLabel} optionalLabel={m.common.optional}>
              {({ id }) => <Textarea id={id} rows={2} maxLength={500} placeholder={m.item.customNotePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <Button variant="secondary">{m.common.cancel}</Button>
              </Dialog.Close>
              <Button type="submit" loading={pending}>
                {m.item.customSubmit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

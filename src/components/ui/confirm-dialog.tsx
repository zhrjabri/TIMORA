"use client";

import { AlertDialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./button";

type ConfirmDialogProps = {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => Promise<boolean | void> | boolean | void;
};

/** Used only for destructive or hard-to-reverse actions. Focus starts on Cancel. */
export function ConfirmDialog({ trigger, title, description, confirmLabel, cancelLabel, confirmVariant = "danger", onConfirm }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-[rise-in_160ms_ease-out]" />
        <AlertDialog.Content className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-card border border-line bg-surface p-6 shadow-float focus:outline-none sm:inset-x-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 data-[state=open]:animate-[rise-in_180ms_var(--ease-out-soft)]">
          <AlertDialog.Title className="font-display text-lg font-semibold text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-ink-2">{description}</AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={confirmVariant}
              loading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  const result = await onConfirm();
                  if (result !== false) setOpen(false);
                } finally {
                  setPending(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

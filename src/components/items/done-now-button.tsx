"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeItemAction, undoCompletionAction } from "@/app/actions/items";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/i18n/format";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { useActionFeedback } from "./use-action-feedback";

type Props = {
  itemId: string;
  itemName: string;
  source?: "done_now" | "qr";
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
  /** Show the item name to screen readers when several buttons appear in a list. */
  labelWithName?: boolean;
};

function AnimatedCheck({ done }: { done: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      {done ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="24" style={{ animation: "check-draw 320ms var(--ease-out-soft) both" }} />
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" strokeWidth={1.8} />
          <path d="M8.3 12.3l2.6 2.6 4.9-5.1" />
        </>
      )}
    </svg>
  );
}

/**
 * The primary action. Records today as a completion without any confirmation dialog,
 * confirms with a toast, and offers Undo for accidental taps.
 */
export function DoneNowButton({ itemId, itemName, source = "done_now", size = "md", variant = "primary", className = "", labelWithName = false }: Props) {
  const { m, date } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [pending, startTransition] = useTransition();
  const [justDone, setJustDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const undo = (recordId: string) => {
    startTransition(async () => {
      const result = await undoCompletionAction(recordId);
      if (result.ok) {
        toast.success(m.toast.undone);
        router.refresh();
      } else {
        showError(result.error);
      }
    });
  };

  const complete = () => {
    startTransition(async () => {
      const result = await completeItemAction({ itemId, source });
      if (!result.ok) {
        showError(result.error);
        return;
      }
      setJustDone(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setJustDone(false), 1800);
      const { recordId, nextDue } = result.data;
      toast.success(m.toast.done, {
        description: `${itemName} · ${nextDue ? fmt(m.toast.doneNext, { date: date(nextDue, "medium") }) : m.toast.doneNoNext}`,
        duration: 8000,
        action: { label: m.common.undo, onClick: () => undo(recordId) },
      });
      router.refresh();
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={complete}
      disabled={pending}
      aria-label={labelWithName ? fmt(m.item.doneNowFor, { name: itemName }) : undefined}
      className={className}
      icon={<AnimatedCheck done={justDone} />}
    >
      {m.item.doneNow}
    </Button>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { undoCompletionAction } from "@/app/actions/items";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { useActionFeedback } from "./use-action-feedback";

/** Undo is a correction, not a deletion: the record stays in history, so no confirmation dialog. */
export function UndoCompletionButton({ recordId }: { recordId: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="md"
      loading={pending}
      icon={<Undo2 className="size-4" aria-hidden />}
      onClick={() =>
        startTransition(async () => {
          const result = await undoCompletionAction(recordId);
          if (!result.ok) return showError(result.error);
          toast.success(m.toast.undone);
          router.refresh();
        })
      }
    >
      <span className="sr-only sm:not-sr-only">{m.history.undoAction}</span>
    </Button>
  );
}

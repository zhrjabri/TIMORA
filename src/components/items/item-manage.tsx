"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, RefreshCw, Trash2 } from "lucide-react";
import { deleteItemAction, regenerateQrAction, setArchivedAction } from "@/app/actions/items";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useActionFeedback } from "./use-action-feedback";

export function ArchiveButton({ itemId, archived }: { itemId: string; archived: boolean }) {
  const { m } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      loading={pending}
      icon={archived ? <ArchiveRestore className="size-4.5" aria-hidden /> : <Archive className="size-4.5" aria-hidden />}
      onClick={() =>
        startTransition(async () => {
          const result = await setArchivedAction(itemId, !archived);
          if (!result.ok) return showError(result.error);
          toast.success(archived ? m.toast.restored : m.toast.archived, {
            action: archived
              ? undefined
              : {
                  label: m.common.undo,
                  onClick: async () => {
                    const undo = await setArchivedAction(itemId, false);
                    if (undo.ok) router.refresh();
                  },
                },
          });
          router.refresh();
        })
      }
    >
      {archived ? m.item.restoreAction : m.item.archiveAction}
    </Button>
  );
}

export function DeleteItemButton({ itemId, itemName }: { itemId: string; itemName: string }) {
  const { m, fmt } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();

  return (
    <ConfirmDialog
      trigger={
        <Button variant="quiet-danger" icon={<Trash2 className="size-4.5" aria-hidden />}>
          {m.common.delete}
        </Button>
      }
      title={fmt(m.item.deleteTitle, { name: itemName })}
      description={m.item.deleteBody}
      confirmLabel={m.item.deleteConfirm}
      cancelLabel={m.common.cancel}
      onConfirm={async () => {
        const result = await deleteItemAction(itemId);
        if (!result.ok) {
          showError(result.error);
          return false;
        }
        toast.success(m.toast.deleted);
        router.replace("/items");
        router.refresh();
      }}
    />
  );
}

export function RegenerateQrButton({ itemId }: { itemId: string }) {
  const { m } = useI18n();
  const router = useRouter();
  const { showError } = useActionFeedback();

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" aria-hidden />}>
          {m.item.qrRegenerate}
        </Button>
      }
      title={m.item.qrRegenerateTitle}
      description={m.item.qrRegenerateBody}
      confirmLabel={m.item.qrRegenerate}
      confirmVariant="primary"
      cancelLabel={m.common.cancel}
      onConfirm={async () => {
        const result = await regenerateQrAction(itemId);
        if (!result.ok) {
          showError(result.error);
          return false;
        }
        toast.success(m.item.qrRegenerated);
        router.refresh();
      }}
    />
  );
}

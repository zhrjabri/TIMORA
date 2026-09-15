"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n/provider";
import type { ActionErrorCode } from "@/lib/actions/result";

/** Turns action error codes into clear, translated feedback. */
export function useActionFeedback() {
  const { m } = useI18n();
  const router = useRouter();

  const messageFor = (code: ActionErrorCode): string => {
    switch (code) {
      case "duplicate_completion":
        return m.toast.duplicate;
      case "item_archived":
        return m.toast.archivedItem;
      case "completion_in_future":
        return m.toast.futureDate;
      case "item_limit_reached":
        return m.toast.limit;
      case "category_limit_reached":
        return m.categories.limit;
      case "duplicate":
        return m.categories.duplicate;
      case "not_found":
        return m.toast.notFound;
      case "rate_limited":
        return m.common.tooManyRequests;
      default:
        return typeof navigator !== "undefined" && !navigator.onLine ? m.common.offline : m.common.genericError;
    }
  };

  return {
    messageFor,
    showError: (code: ActionErrorCode) => {
      if (code === "unauthorized") {
        router.push(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (code === "duplicate_completion") {
        toast.info(m.toast.duplicate);
        return;
      }
      toast.error(messageFor(code));
    },
  };
}

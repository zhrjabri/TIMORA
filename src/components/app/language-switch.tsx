"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/preferences";
import { useI18n } from "@/i18n/provider";

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      lang={next}
      aria-label={m.common.switchToOtherLabel}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setLocaleAction(next);
          router.refresh();
        })
      }
      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-control px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      <Languages className="size-4.5" aria-hidden />
      {compact ? null : <span>{m.common.switchToOther}</span>}
    </button>
  );
}

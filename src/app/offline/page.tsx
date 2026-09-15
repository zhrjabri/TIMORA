import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { Mark } from "@/components/brand/logo";
import { RetryButton } from "@/components/app/retry-button";

export const metadata: Metadata = { robots: { index: false } };

export default async function OfflinePage() {
  const { m } = await getI18n();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Mark variant="compact" className="size-14 text-ink" />
      <WifiOff className="size-6 text-ink-2" aria-hidden />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">{m.errors.offlineTitle}</h1>
        <p className="text-ink-2">{m.errors.offlineBody}</p>
      </div>
      <RetryButton label={m.common.retry} />
    </main>
  );
}

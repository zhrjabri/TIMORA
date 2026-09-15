"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/provider";
import { Button, LinkButton } from "@/components/ui/button";
import { Mark } from "@/components/brand/logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { m } = useI18n();
  useEffect(() => {
    // Only the opaque digest is logged; no user data is included.
    console.error("TIMORA page error", error.digest ?? "");
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Mark variant="compact" className="size-14 text-ink" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-ink">{m.errors.errorTitle}</h1>
        <p className="text-ink-2">{m.errors.errorBody}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" onClick={reset}>
          {m.common.retry}
        </Button>
        <LinkButton href="/dashboard" size="lg" variant="secondary">
          {m.errors.notFoundAction}
        </LinkButton>
      </div>
    </main>
  );
}

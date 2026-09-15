import { getI18n } from "@/i18n/server";
import { LinkButton } from "@/components/ui/button";
import { Mark } from "@/components/brand/logo";

export default async function NotFound() {
  const { m } = await getI18n();
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Mark variant="primary" className="size-16 text-ink" />
      <div className="flex flex-col gap-2">
        <p className="tabular font-display text-sm font-medium tracking-[0.3em] text-ink-2">404</p>
        <h1 className="font-display text-2xl font-semibold text-ink">{m.errors.notFoundTitle}</h1>
        <p className="text-ink-2">{m.errors.notFoundBody}</p>
      </div>
      <LinkButton href="/" size="lg">
        {m.errors.notFoundAction}
      </LinkButton>
    </main>
  );
}

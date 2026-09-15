import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { getSessionUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { Lockup } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { LanguageSwitch } from "./language-switch";

export async function PublicHeader({ showAuthLinks = true }: { showAuthLinks?: boolean }) {
  const { locale, m } = await getI18n();
  const user = hasSupabaseEnv() ? await getSessionUser() : null;
  return (
    <header className="mx-auto flex h-18 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link href="/" className="rounded-control" aria-label={m.common.appName}>
        <Lockup locale={locale} variant="compact" markClassName="size-8" className="sm:hidden" />
        <Lockup locale={locale} variant="primary" markClassName="size-9" className="max-sm:hidden" />
      </Link>
      <div className="flex items-center gap-1.5">
        <LanguageSwitch />
        {showAuthLinks ? (
          user ? (
            <LinkButton href="/dashboard" size="md">
              {m.landing.ctaDashboard}
            </LinkButton>
          ) : (
            <LinkButton href="/sign-in" variant="ghost" size="md">
              {m.auth.signInTitle}
            </LinkButton>
          )
        ) : null}
      </div>
    </header>
  );
}

export async function PublicFooter() {
  const { m } = await getI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © 2026 {m.common.appName} · {m.landing.footerNote}
        </p>
        <nav aria-label={m.legal.privacyTitle} className="flex gap-4">
          <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
            {m.legal.privacyTitle}
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
            {m.legal.termsTitle}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

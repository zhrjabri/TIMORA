import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { Lockup } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";
import { BottomNav, DesktopNav } from "@/components/app/nav";
import { LanguageSwitch } from "@/components/app/language-switch";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const { locale, m } = await getI18n();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="rounded-control" aria-label={`${m.common.appName} — ${m.nav.dashboard}`}>
              <Lockup locale={locale} variant="compact" markClassName="size-8" className="md:hidden" />
              <Lockup locale={locale} variant="primary" markClassName="size-9" className="max-md:hidden" />
            </Link>
            <DesktopNav />
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageSwitch compact />
            <LinkButton href="/items/new" size="md" className="max-md:hidden" icon={<Plus className="size-4.5" aria-hidden />}>
              {m.form.createTitle}
            </LinkButton>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-32 sm:px-6 md:pt-10 md:pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound, LogOut } from "lucide-react";
import { getI18n, getThemePreference } from "@/i18n/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { signOutAction } from "@/app/actions/preferences";
import { Button, buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { SettingsForm } from "@/components/settings/settings-form";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.settings.title };
}

export default async function SettingsPage() {
  const [{ locale, m }, profile, user, theme] = await Promise.all([getI18n(), getProfile(), getSessionUser(), getThemePreference()]);
  const timeZones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title={m.settings.title} />
      <SettingsForm
        timeZones={timeZones}
        initial={{
          displayName: profile?.display_name ?? "",
          locale: profile?.locale ?? locale,
          timezone: profile?.timezone ?? "UTC",
          theme: profile?.theme ?? theme,
        }}
      />

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 sm:p-6" aria-labelledby="settings-account">
        <h2 id="settings-account" className="font-display text-lg font-semibold text-ink">
          {m.settings.account}
        </h2>
        <dl className="flex flex-col gap-0.5">
          <dt className="text-sm text-ink-2">{m.settings.email}</dt>
          <dd className="font-medium break-all text-ink" dir="ltr">
            {user?.email}
          </dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Link href="/reset-password" className={buttonClasses("secondary", "md")}>
            <KeyRound className="size-4.5" aria-hidden />
            {m.settings.changePassword}
          </Link>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" icon={<LogOut className="size-4.5 rtl:-scale-x-100" aria-hidden />}>
              {m.common.signOut}
            </Button>
          </form>
        </div>
        <p className="border-t border-line pt-4 text-sm text-ink-2">
          <Link href="/privacy" className="underline underline-offset-4">
            {m.legal.privacyTitle}
          </Link>
          <span aria-hidden className="mx-2">
            ·
          </span>
          <Link href="/terms" className="underline underline-offset-4">
            {m.legal.termsTitle}
          </Link>
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { getEnv } from "@/lib/env";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.auth.forgotTitle };
}

export default async function ForgotPasswordPage() {
  const { m } = await getI18n();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">{m.auth.forgotTitle}</h1>
        <p className="text-ink-2">{m.auth.forgotSubtitle}</p>
      </div>
      <ForgotPasswordForm siteUrl={getEnv().NEXT_PUBLIC_SITE_URL} />
    </div>
  );
}

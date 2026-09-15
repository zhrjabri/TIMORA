import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { getEnv } from "@/lib/env";
import { SignUpForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.auth.signUpTitle };
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ m }, params] = await Promise.all([getI18n(), searchParams]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">{m.auth.signUpTitle}</h1>
        <p className="text-ink-2">{m.auth.signUpSubtitle}</p>
      </div>
      <SignUpForm next={typeof params.next === "string" ? params.next : undefined} siteUrl={getEnv().NEXT_PUBLIC_SITE_URL} />
    </div>
  );
}

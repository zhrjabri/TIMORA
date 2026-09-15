import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { SignInForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.auth.signInTitle };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ m }, params] = await Promise.all([getI18n(), searchParams]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">{m.auth.signInTitle}</h1>
        <p className="text-ink-2">{m.auth.signInSubtitle}</p>
      </div>
      {params.error === "link" ? (
        <p role="alert" className="rounded-control bg-overdue-bg px-4 py-3 text-sm text-overdue">
          {m.auth.errors.linkExpired}
        </p>
      ) : null}
      <SignInForm next={typeof params.next === "string" ? params.next : undefined} />
    </div>
  );
}

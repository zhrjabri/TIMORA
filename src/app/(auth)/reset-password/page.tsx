import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { getSessionUser } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.auth.resetTitle, robots: { index: false } };
}

/** Reached from the recovery email (via /auth/confirm, which creates a session) or from Settings. */
export default async function ResetPasswordPage() {
  const [{ m }, user] = await Promise.all([getI18n(), getSessionUser()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-ink">{m.auth.resetTitle}</h1>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="flex flex-col gap-4">
          <p role="alert" className="rounded-control bg-overdue-bg px-4 py-3 text-sm text-overdue">
            {m.auth.errors.sessionMissing}
          </p>
          <LinkButton href="/forgot-password" variant="secondary">
            {m.auth.forgotTitle}
          </LinkButton>
        </div>
      )}
    </div>
  );
}

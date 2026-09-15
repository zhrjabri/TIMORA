"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MailCheck, ScanLine } from "lucide-react";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { syncPreferencesAction } from "@/app/actions/preferences";
import { useI18n } from "@/i18n/provider";
import { forgotSchema, resetSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";
import { safeNextPath } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function useAuthErrorText() {
  const { m } = useI18n();
  return (error: AuthError | Error | null | undefined): string => {
    const code = (error as AuthError | undefined)?.code;
    const status = (error as AuthError | undefined)?.status;
    if (code === "invalid_credentials") return m.auth.errors.invalidCredentials;
    if (code === "email_not_confirmed") return m.auth.errors.emailNotConfirmed;
    if (code === "weak_password") return m.auth.errors.weakPassword;
    if (code === "user_already_exists" || code === "email_exists") return m.auth.errors.userExists;
    if (code === "session_not_found" || code === "session_expired") return m.auth.errors.sessionMissing;
    if (code?.startsWith("over_") || status === 429) return m.auth.errors.rateLimited;
    if (typeof navigator !== "undefined" && !navigator.onLine) return m.common.offline;
    return m.common.genericError;
  };
}

/**
 * Full navigation after authentication: the next request carries the new session cookies
 * to the server, and destinations that are route handlers (QR scans) redirect correctly.
 */
function goTo(path: string) {
  window.location.replace(new URL(path, window.location.origin).toString());
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control bg-overdue-bg px-4 py-3 text-sm text-overdue">
      {message}
    </p>
  );
}

function validationText(m: ReturnType<typeof useI18n>["m"], code: string | undefined) {
  if (!code) return undefined;
  const text = m.validation[code as keyof typeof m.validation];
  return text ? text.replace("{max}", "72") : m.common.genericError;
}

export function SignInForm({ next }: { next?: string }) {
  const { m } = useI18n();
  const errorText = useAuthErrorText();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const destination = safeNextPath(next);
  const fromScan = destination.startsWith("/q/");

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        const parsed = signInSchema.safeParse(data);
        if (!parsed.success) {
          setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setFieldErrors({});
        setFormError(undefined);
        startTransition(async () => {
          const { error } = await createClient().auth.signInWithPassword(parsed.data);
          if (error) return setFormError(errorText(error));
          await syncPreferencesAction();
          goTo(destination);
        });
      }}
    >
      {fromScan ? (
        <p className="flex items-center gap-2 rounded-control bg-surface-muted px-4 py-3 text-sm text-ink" role="status">
          <ScanLine className="size-4.5 shrink-0" aria-hidden />
          {m.auth.scanNotice}
        </p>
      ) : null}
      <FormError message={formError} />
      <Field label={m.auth.email} error={validationText(m, fieldErrors.email)}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" required aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Field label={m.auth.password} error={validationText(m, fieldErrors.password)}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="password" type="password" autoComplete="current-password" dir="ltr" required aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="rounded-sm text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
          {m.auth.forgotLink}
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {m.auth.signInAction}
      </Button>
      <p className="text-center text-sm text-ink-2">
        {m.auth.noAccount}{" "}
        <Link href={next ? `/sign-up?next=${encodeURIComponent(destination)}` : "/sign-up"} className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
          {m.auth.signUpTitle}
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next, siteUrl }: { next?: string; siteUrl: string }) {
  const { m, locale, fmt } = useI18n();
  const errorText = useAuthErrorText();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const destination = safeNextPath(next);

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <span className="grid size-14 place-items-center rounded-2xl bg-good-bg text-good">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="font-display text-xl font-semibold text-ink">{m.auth.checkEmailTitle}</h2>
        <p className="text-ink-2">{fmt(m.auth.checkEmailBody, { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        const parsed = signUpSchema.safeParse(data);
        if (!parsed.success) {
          setFieldErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setFieldErrors({});
        setFormError(undefined);
        startTransition(async () => {
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
          const { data: result, error } = await createClient().auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
              emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(destination)}`,
              data: { locale, timezone },
            },
          });
          if (error) return setFormError(errorText(error));
          if (result.session) {
            await syncPreferencesAction();
            goTo(destination);
            return;
          }
          // Same response whether or not the address already exists, so accounts can't be enumerated.
          setSentTo(parsed.data.email);
        });
      }}
    >
      <FormError message={formError} />
      <Field label={m.auth.email} error={validationText(m, fieldErrors.email)}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" required aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Field label={m.auth.password} hint={m.auth.passwordHint} error={validationText(m, fieldErrors.password)}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="password" type="password" autoComplete="new-password" dir="ltr" minLength={8} required aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {m.auth.signUpAction}
      </Button>
      <p className="text-center text-xs leading-relaxed text-ink-2">
        {m.auth.agree.split(/(\{terms\}|\{privacy\})/).map((part, i) =>
          part === "{terms}" ? (
            <Link key={i} href="/terms" className="underline underline-offset-2">
              {m.legal.termsTitle}
            </Link>
          ) : part === "{privacy}" ? (
            <Link key={i} href="/privacy" className="underline underline-offset-2">
              {m.legal.privacyTitle}
            </Link>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>
      <p className="text-center text-sm text-ink-2">
        {m.auth.haveAccount}{" "}
        <Link href={next ? `/sign-in?next=${encodeURIComponent(destination)}` : "/sign-in"} className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4">
          {m.auth.signInTitle}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({ siteUrl }: { siteUrl: string }) {
  const { m } = useI18n();
  const errorText = useAuthErrorText();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-control bg-good-bg px-4 py-3 text-good">
        <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        {m.auth.forgotSent}
      </p>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = forgotSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
        setFieldError(undefined);
        setFormError(undefined);
        startTransition(async () => {
          const { error } = await createClient().auth.resetPasswordForEmail(parsed.data.email, {
            redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
          });
          // Only rate limits are surfaced; unknown addresses get the same neutral confirmation.
          if (error && (error.status === 429 || error.code?.startsWith("over_"))) return setFormError(errorText(error));
          setSent(true);
        });
      }}
    >
      <FormError message={formError} />
      <Field label={m.auth.email} error={validationText(m, fieldError)}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" required aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {m.auth.forgotAction}
      </Button>
      <p className="text-center text-sm">
        <Link href="/sign-in" className="text-ink-2 underline underline-offset-4 hover:text-ink">
          {m.auth.signInTitle}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const { m } = useI18n();
  const router = useRouter();
  const errorText = useAuthErrorText();
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = resetSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
        if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
        setFieldError(undefined);
        setFormError(undefined);
        startTransition(async () => {
          const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
          if (error) return setFormError(error.name === "AuthSessionMissingError" ? m.auth.errors.sessionMissing : errorText(error));
          toast.success(m.auth.resetDone);
          router.replace("/dashboard");
          router.refresh();
        });
      }}
    >
      <FormError message={formError} />
      <Field label={m.auth.newPassword} hint={m.auth.passwordHint} error={validationText(m, fieldError)}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} name="password" type="password" autoComplete="new-password" dir="ltr" minLength={8} required aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {m.auth.resetAction}
      </Button>
    </form>
  );
}

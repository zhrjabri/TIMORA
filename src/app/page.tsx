import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, CalendarPlus, LayoutList, QrCode, ShieldCheck } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { getSessionUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Mark } from "@/components/brand/logo";
import { PublicFooter, PublicHeader } from "@/components/app/public-shell";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: { absolute: `${m.meta.title} — ${m.meta.tagline}` } };
}

/**
 * The ruler motif from the logo, drawn as an explanatory interval diagram. Unlike the logo,
 * this diagram follows the reading direction so "last done → next due" reads naturally.
 */
function IntervalRuler({ lastLabel, nextLabel }: { lastLabel: string; nextLabel: string }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <svg viewBox="0 0 320 56" className="h-auto w-full text-ink ltr:-scale-x-100" preserveAspectRatio="none">
        <path d="M6 44H314" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {[296, 262, 228, 194].map((x) => (
          <path key={x} d={`M${x} 44V32`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ))}
        <path d="M60 44V36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M60 10l9 10-9 10-9-10z" fill="var(--brand-gold)" />
        <path d="M84 44H180" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round" />
      </svg>
      <div className="flex justify-between text-xs text-ink-2">
        <span>{lastLabel}</span>
        <span>{nextLabel}</span>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const { locale, dir, m } = await getI18n();
  const user = hasSupabaseEnv() ? await getSessionUser() : null;
  const Forward = dir === "rtl" ? ArrowLeft : ArrowRight;
  const featureIcons = [LayoutList, CalendarPlus, ShieldCheck];

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:pt-16 md:pb-24">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-medium text-accent-ink">{m.landing.eyebrow}</p>
            <h1 className="font-display text-[2.1rem] leading-[1.2] font-semibold text-ink sm:text-5xl sm:leading-[1.15]">{m.landing.title}</h1>
            <p className="max-w-xl text-lg text-ink-2">{m.landing.subtitle}</p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              {user ? (
                <LinkButton href="/dashboard" size="lg" icon={<Forward className="size-5" aria-hidden />}>
                  {m.landing.ctaDashboard}
                </LinkButton>
              ) : (
                <>
                  <LinkButton href="/sign-up" size="lg">
                    {m.landing.ctaStart}
                  </LinkButton>
                  <LinkButton href="/sign-in" size="lg" variant="secondary">
                    {m.landing.ctaSignIn}
                  </LinkButton>
                </>
              )}
            </div>
          </div>

          <figure className="flex flex-col gap-4" aria-label={m.landing.exampleTitle}>
            <div className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-float sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink">
                  <Mark variant="compact" className="size-7" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{m.landing.exampleItem}</span>
                    <StatusBadge status="overdue" label={m.status.overdue} size="sm" />
                  </div>
                  <span className="text-sm font-medium text-overdue">{m.landing.exampleStatus}</span>
                  <span className="text-sm text-ink-2">{m.landing.exampleMeta}</span>
                </div>
              </div>
              <div className="mt-6">
                <IntervalRuler lastLabel={m.item.lastDone} nextLabel={m.item.nextDue} />
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 rounded-control bg-primary px-4 py-3 font-medium text-primary-ink">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="8.5" strokeWidth="1.8" />
                  <path d="M8.3 12.3l2.6 2.6 4.9-5.1" />
                </svg>
                {m.item.doneNow}
              </div>
            </div>
            <figcaption className="sr-only">{m.landing.exampleTitle}</figcaption>
          </figure>
        </section>

        <section aria-labelledby="how" className="border-y border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 md:py-20">
            <h2 id="how" className="font-display text-2xl font-semibold text-ink sm:text-3xl">
              {m.landing.howTitle}
            </h2>
            <ol className="grid gap-6 md:grid-cols-3">
              {m.landing.how.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span className="flex items-center gap-3">
                    <span className="tabular grid size-9 place-items-center rounded-full border border-line-strong font-display text-sm font-semibold text-ink">
                      {index + 1}
                    </span>
                    {index === 2 ? <QrCode className="size-5 text-ink-2" aria-hidden /> : null}
                  </span>
                  <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="text-ink-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="examples" className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:py-20">
          <h2 id="examples" className="font-display text-2xl font-semibold text-ink sm:text-3xl">
            {m.landing.examplesTitle}
          </h2>
          <ul className="flex flex-wrap gap-2.5">
            {m.landing.examples.map((example) => (
              <li key={example} className="rounded-full border border-line bg-surface px-4 py-2 text-ink">
                {example}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="features" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-16 sm:px-6 md:pb-24">
          <h2 id="features" className="font-display text-2xl font-semibold text-ink sm:text-3xl">
            {m.landing.featuresTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {m.landing.features.map((feature, index) => {
              const Icon = featureIcons[index] ?? LayoutList;
              return (
                <div key={feature.title} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
                  <Icon className="size-6 text-ink" strokeWidth={1.75} aria-hidden />
                  <h3 className="text-lg font-semibold text-ink">{feature.title}</h3>
                  <p className="text-ink-2">{feature.body}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-ink-2" lang={locale}>
            {m.landing.disclaimer}
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

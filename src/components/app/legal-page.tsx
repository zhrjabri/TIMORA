import { getI18n } from "@/i18n/server";
import { PublicFooter, PublicHeader } from "./public-shell";

export async function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { m } = await getI18n();
  const sections = kind === "privacy" ? m.legal.privacy : m.legal.terms;
  const title = kind === "privacy" ? m.legal.privacyTitle : m.legal.termsTitle;
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-20 sm:px-6">
        <article className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
            <p className="text-sm text-ink-2">{m.legal.updated}</p>
          </header>
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-ink">{section.heading}</h2>
              <p className="leading-relaxed text-ink-2">{section.body}</p>
            </section>
          ))}
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}

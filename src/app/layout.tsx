import type { Metadata, Viewport } from "next";
import { Alexandria, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { getI18n, getThemePreference } from "@/i18n/server";
import { I18nProvider } from "@/i18n/provider";
import { AppToaster } from "@/components/app/toaster";
import { ServiceWorker } from "@/components/app/service-worker";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600"],
  variable: "--font-alexandria",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(siteUrl),
    title: { default: `${m.meta.title} · ${m.meta.tagline}`, template: `%s · ${m.meta.title}` },
    description: m.meta.description,
    applicationName: "TIMORA",
    appleWebApp: { capable: true, title: "TIMORA", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, dir, m }, theme] = await Promise.all([getI18n(), getThemePreference()]);

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme === "system" ? undefined : theme}
      className={`${plexArabic.variable} ${plex.variable} ${alexandria.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-ink"
        >
          {m.common.skipToContent}
        </a>
        <I18nProvider locale={locale} dir={dir} messages={m}>
          {children}
          <AppToaster />
        </I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}

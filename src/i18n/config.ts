export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "timora-locale";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "timora-theme";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * BCP 47 tags used for all Intl formatting.
 * MVP uses the Gregorian calendar explicitly. Hijri support later only needs a
 * different `ca` value here (e.g. "islamic-umalqura"), not changes in components.
 * Arabic uses Latin digits for clarity when dates, counts and codes appear together.
 */
export const INTL_TAG: Record<Locale, string> = {
  ar: "ar-u-ca-gregory-nu-latn",
  en: "en-u-ca-gregory",
};

/**
 * Picks the interface language. TIMORA is Arabic-first: Arabic is used unless the visitor
 * has chosen English (language switch or saved profile preference). The browser's
 * Accept-Language is intentionally not used, so the default never flips unexpectedly.
 */
export function resolveLocale(cookieValue: string | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
}

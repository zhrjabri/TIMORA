import { INTL_TAG, type Locale } from "./config";
import { parseLocalDate, type LocalDate } from "@/lib/domain/dates";

export type Plural = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

/** Declares a pluralised message. Arabic uses all six CLDR categories; English uses one/other. */
export function p(forms: Plural): Plural {
  return forms;
}

const pluralRulesCache = new Map<Locale, Intl.PluralRules>();
const numberCache = new Map<Locale, Intl.NumberFormat>();

export function formatNumber(locale: Locale, value: number): string {
  let nf = numberCache.get(locale);
  if (!nf) {
    nf = new Intl.NumberFormat(INTL_TAG[locale]);
    numberCache.set(locale, nf);
  }
  return nf.format(value);
}

/** Replaces {placeholders} with values. Values are plain text; React escapes them on render. */
export function fmt(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

export function plural(locale: Locale, forms: Plural, count: number, values: Record<string, string | number> = {}): string {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(INTL_TAG[locale]);
    pluralRulesCache.set(locale, rules);
  }
  // Explicit zero form is used for 0 even in languages whose CLDR rules map 0 to "other".
  const category = count === 0 && forms.zero ? "zero" : rules.select(count);
  const template = forms[category as keyof Plural] ?? forms.other;
  return fmt(template, { count: formatNumber(locale, count), ...values });
}

export type DateStyle = "long" | "medium" | "short" | "weekday";

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: "numeric", month: "long", year: "numeric" },
  medium: { day: "numeric", month: "short", year: "numeric" },
  short: { day: "numeric", month: "short" },
  weekday: { weekday: "long", day: "numeric", month: "long" },
};

/** Formats a calendar date without any timezone shift. */
export function formatLocalDate(locale: Locale, date: LocalDate, style: DateStyle = "medium"): string {
  const { year, month, day } = parseLocalDate(date);
  return new Intl.DateTimeFormat(INTL_TAG[locale], { ...DATE_OPTIONS[style], timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** Formats a UTC instant in the user's timezone. */
export function formatInstant(locale: Locale, iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

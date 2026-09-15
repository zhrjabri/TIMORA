"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { fmt, formatLocalDate, plural, type DateStyle, type Plural } from "./format";
import type { Messages } from "./messages";

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  m: Messages;
  fmt: typeof fmt;
  plural: (forms: Plural, count: number, values?: Record<string, string | number>) => string;
  date: (value: string, style?: DateStyle) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, dir, messages, children }: { locale: Locale; dir: "rtl" | "ltr"; messages: Messages; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir,
      m: messages,
      fmt,
      plural: (forms, count, values) => plural(locale, forms, count, values),
      date: (v, style) => formatLocalDate(locale, v, style),
    }),
    [locale, dir, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

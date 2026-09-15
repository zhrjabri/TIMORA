import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { directionOf, isTheme, LOCALE_COOKIE, resolveLocale, THEME_COOKIE, type Locale, type Theme } from "./config";
import { getMessages, type Messages } from "./messages";

export type I18n = {
  locale: Locale;
  dir: "rtl" | "ltr";
  m: Messages;
};

export const getI18n = cache(async (): Promise<I18n> => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  return { locale, dir: directionOf(locale), m: getMessages(locale) };
});

export const getThemePreference = cache(async (): Promise<Theme> => {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "system";
});

export const PREFERENCE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
};

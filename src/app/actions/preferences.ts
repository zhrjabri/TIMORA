"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { guardMutation } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { settingsSchema } from "@/lib/validation/schemas";
import { isLocale, isTheme, LOCALE_COOKIE, THEME_COOKIE, type Locale, type Theme } from "@/i18n/config";
import { PREFERENCE_COOKIE_OPTIONS } from "@/i18n/server";
import { rateLimit } from "@/lib/rate-limit";

async function writePreferenceCookies(locale?: Locale, theme?: Theme) {
  const store = await cookies();
  if (locale) store.set(LOCALE_COOKIE, locale, PREFERENCE_COOKIE_OPTIONS);
  if (theme) store.set(THEME_COOKIE, theme, PREFERENCE_COOKIE_OPTIONS);
}

/** Language switch, available signed in or out. Signed-in users also get their profile updated. */
export async function setLocaleAction(locale: unknown): Promise<ActionResult> {
  if (!isLocale(locale)) return fail("invalid");
  await writePreferenceCookies(locale);
  const user = await getSessionUser();
  if (user && rateLimit(`prefs:${user.id}`, 30, 60_000).ok) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
  return ok(null);
}

export async function updateSettingsAction(values: unknown): Promise<ActionResult> {
  const guard = await guardMutation("prefs", 30);
  if ("error" in guard) return fail(guard.error);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      theme: parsed.data.theme,
    })
    .eq("id", guard.user.id);
  if (error) return fail(fromDbError(error));

  await writePreferenceCookies(parsed.data.locale, parsed.data.theme);
  revalidatePath("/", "layout");
  return ok(null);
}

/** Called right after sign-in so the interface follows the preferences saved in the profile. */
export async function syncPreferencesAction(): Promise<ActionResult<{ locale: Locale }>> {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("locale, theme").eq("id", user.id).maybeSingle();
  if (!data) return fail("not_found");
  const locale = isLocale(data.locale) ? data.locale : undefined;
  const theme = isTheme(data.theme) ? data.theme : undefined;
  await writePreferenceCookies(locale, theme);
  return ok({ locale: locale ?? "ar" });
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { localDateInTimeZone } from "@/lib/domain/dates";
import type { Profile } from "@/lib/database.types";

export type SessionUser = { id: string; email: string | null };

/** Verifies the session JWT (signature and expiry) rather than trusting cookie contents. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : null };
});

/** Use at the top of every protected page and server action. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in");
  }
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/** Today's calendar date in the user's timezone. */
export async function getUserToday(): Promise<{ today: string; timeZone: string }> {
  const profile = await getProfile();
  const timeZone = profile?.timezone ?? "UTC";
  return { today: localDateInTimeZone(new Date(), timeZone), timeZone };
}

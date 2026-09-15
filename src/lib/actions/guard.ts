import "server-only";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Every mutation starts here: verify the session server-side (never trust the UI),
 * then apply a per-user burst limit. RLS remains the final authority in the database.
 */
export async function guardMutation(bucket: string, limit = 60, windowMs = 60_000): Promise<{ user: SessionUser } | { error: "unauthorized" | "rate_limited" }> {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };
  if (!rateLimit(`${bucket}:${user.id}`, limit, windowMs).ok) return { error: "rate_limited" };
  return { user };
}

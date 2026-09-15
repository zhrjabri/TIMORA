/**
 * Small fixed-window limiter kept in memory per server instance.
 * It is a best-effort guard against bursts from one user (e.g. scripted QR lookups
 * or mutation spam). It is not a distributed limit; authentication endpoints rely on
 * Supabase Auth's own per-IP limits, and the database guards double completions.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, w] of windows) {
        if (w.resetAt <= now) windows.delete(k);
      }
      if (windows.size >= MAX_KEYS) windows.clear();
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  current.count += 1;
  if (current.count > limit) return { ok: false, retryAfterMs: current.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}

export function resetRateLimits() {
  windows.clear();
}

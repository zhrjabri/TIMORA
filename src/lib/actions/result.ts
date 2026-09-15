import type { ZodError } from "zod";

export type ActionErrorCode =
  | "unauthorized"
  | "invalid"
  | "not_found"
  | "rate_limited"
  | "duplicate"
  | "duplicate_completion"
  | "item_archived"
  | "completion_in_future"
  | "item_limit_reached"
  | "category_limit_reached"
  | "unknown";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: ActionErrorCode; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: ActionErrorCode, fieldErrors?: Record<string, string>): { ok: false; error: ActionErrorCode; fieldErrors?: Record<string, string> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

export function fromZod(error: ZodError): { ok: false; error: ActionErrorCode; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "invalid", fieldErrors };
}

const KNOWN_DB_ERRORS: ActionErrorCode[] = [
  "duplicate_completion",
  "item_archived",
  "completion_in_future",
  "item_limit_reached",
  "category_limit_reached",
];

/** Maps database errors to stable codes without leaking internal messages to the client. */
export function fromDbError(error: { code?: string; message?: string } | null): ActionErrorCode {
  if (!error) return "unknown";
  const message = error.message ?? "";
  const known = KNOWN_DB_ERRORS.find((code) => message.includes(code));
  if (known) return known;
  if (error.code === "23505") return "duplicate";
  if (error.code === "23503" || error.code === "PGRST116" || message.includes("not_found")) return "not_found";
  if (error.code === "23514" || error.code === "22023" || error.code === "22P02") return "invalid";
  if (error.code === "42501") return "unauthorized";
  return "unknown";
}

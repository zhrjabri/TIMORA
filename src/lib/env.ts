import { z } from "zod";

/**
 * Public configuration only. TIMORA needs no server secrets: all data access runs
 * as the signed-in user and is enforced by Row-Level Security.
 * Values are referenced statically so Next.js can inline them into the client bundle.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url({ protocol: /^https?$/ }).transform((v) => v.replace(/\/+$/, "")),
});

export type PublicEnv = z.infer<typeof schema>;

let cached: PublicEnv | null = null;

export function getEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}. See .env.example.`);
  }
  if (/service_role|sb_secret_/i.test(parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error("A secret Supabase key was supplied as the public key. Use the publishable (anon) key only.");
  }
  cached = parsed.data;
  return cached;
}

export function hasSupabaseEnv(): boolean {
  try {
    getEnv();
    return true;
  } catch {
    return false;
  }
}

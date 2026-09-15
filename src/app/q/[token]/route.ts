import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { QR_TOKEN_RE } from "@/lib/validation/schemas";

/**
 * QR scan entry point. The token is 244 random bits and is only looked up under the
 * scanning user's RLS scope, so another user's token is indistinguishable from an unknown one.
 * There is no public item page.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const notFound = () => NextResponse.redirect(new URL("/not-found", request.url), { status: 303 });

  if (!QR_TOKEN_RE.test(token)) return notFound();

  const user = await getSessionUser();
  if (!user) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `/q/${token}`);
    return NextResponse.redirect(signIn, { status: 303 });
  }

  if (!rateLimit(`qr-scan:${user.id}`, 30, 60_000).ok) {
    return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("id").eq("qr_token", token).maybeSingle();
  if (!item) return notFound();

  const response = NextResponse.redirect(new URL(`/items/${item.id}?from=qr`, request.url), { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

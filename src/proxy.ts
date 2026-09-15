import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-redirect";

const PROTECTED_PREFIXES = ["/dashboard", "/items", "/categories", "/settings", "/q/", "/api/items"];
const GUEST_ONLY = ["/sign-in", "/sign-up", "/forgot-password"];

function buildCsp(nonce: string, supabaseUrl: string | undefined): string {
  const isDev = process.env.NODE_ENV === "development";
  const connect = ["'self'", supabaseUrl].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by accessible UI primitives; scripts stay nonce-locked.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...((process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const csp = buildCsp(nonce, supabaseUrl);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
  const isGuestOnly = GUEST_ONLY.includes(pathname);

  let userId: string | null = null;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    });
    // Refreshes an expiring session and verifies the JWT.
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub ?? null;
  }

  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  if (isProtected && !userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return redirectTo(`/sign-in?next=${encodeURIComponent(`${pathname}${search}`)}`);
  }
  // Only page navigations are redirected: a 307 would re-send Server Action POSTs to the destination.
  if (isGuestOnly && userId && request.method === "GET" && !request.headers.has("next-action")) {
    return redirectTo(safeNextPath(request.nextUrl.searchParams.get("next")));
  }

  response.headers.set("Content-Security-Policy", csp);
  if (isProtected) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|brand/|sw.js|manifest.webmanifest|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

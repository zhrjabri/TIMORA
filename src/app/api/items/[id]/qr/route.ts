import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { qrPng, qrSvg, qrUrl } from "@/lib/qr";
import { uuidSchema } from "@/lib/validation/schemas";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`qr-file:${user.id}`, 60, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const supabase = await createClient();
  const { data: item } = await supabase.from("items").select("id, qr_token").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = qrUrl(getEnv().NEXT_PUBLIC_SITE_URL, item.qr_token);
  const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";
  const headers = {
    "Content-Disposition": `attachment; filename="timora-qr-${item.id.slice(0, 8)}.${format}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "svg") {
    return new NextResponse(qrSvg(url), {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
    });
  }
  const png = await qrPng(url);
  return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}

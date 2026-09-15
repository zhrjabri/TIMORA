import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getUserToday } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { buildCalendarEvent, calendarFileName } from "@/lib/calendar";
import { toItemView } from "@/lib/items/view";
import { uuidSchema } from "@/lib/validation/schemas";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`ics:${user.id}`, 60, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [supabase, { today }, { m }] = await Promise.all([createClient(), getUserToday(), getI18n()]);
  const { data: row } = await supabase.from("item_overview").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const item = toItemView(row, today);
  if (!item.nextDue || item.archived_at) return NextResponse.json({ error: "no_due_date" }, { status: 409 });

  const link = `${getEnv().NEXT_PUBLIC_SITE_URL}/items/${item.id}`;
  const description = [m.calendar.description, item.note ? fmt(m.calendar.notes, { note: item.note }) : null, fmt(m.calendar.open, { url: link })]
    .filter(Boolean)
    .join("\n");

  const ics = buildCalendarEvent({
    itemId: item.id,
    title: fmt(m.calendar.eventTitle, { name: item.name }),
    dueDate: item.nextDue,
    description,
    url: link,
    alarmText: fmt(m.calendar.alarm, { name: item.name }),
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendarFileName(item.nextDue)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

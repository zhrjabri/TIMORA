import { describe, expect, it } from "vitest";
import { buildCalendarEvent, calendarFileName } from "@/lib/calendar";
import { qrMatrix, qrPath, qrSvg, qrUrl } from "@/lib/qr";
import { safeNextPath } from "@/lib/safe-redirect";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";
import { fmt, formatLocalDate, plural } from "@/i18n/format";
import { resolveLocale } from "@/i18n/config";
import { ar } from "@/i18n/messages/ar";
import { en } from "@/i18n/messages/en";
import { toItemView } from "@/lib/items/view";
import { filterItems, normalizeSearch, sortItems } from "@/lib/items/browse";
import { completionSchema, itemFormSchema, itemFormToColumns, settingsSchema } from "@/lib/validation/schemas";
import type { ItemOverview } from "@/lib/database.types";

describe("calendar export", () => {
  const ics = buildCalendarEvent({
    itemId: "3b9f0a52-9b8e-4d6a-8f0e-6a8f1f2b7c11",
    title: "فلتر ماء المطبخ",
    dueDate: "2026-12-15",
    description: "موعد من تيمورا.\nملاحظات: تحت المغسلة",
    url: "https://timora.example/items/3b9f0a52-9b8e-4d6a-8f0e-6a8f1f2b7c11",
    alarmText: "حان موعد: فلتر ماء المطبخ",
  });
  const unfolded = ics.replace(/\r\n[ \t]/g, "");

  it("produces a valid all-day VEVENT", () => {
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    expect(unfolded).toContain("DTSTART;VALUE=DATE:20261215");
    expect(unfolded).toContain("DTEND;VALUE=DATE:20261216");
    expect(unfolded).toContain("UID:3b9f0a52-9b8e-4d6a-8f0e-6a8f1f2b7c11-2026-12-15@timora.app");
  });

  it("keeps Arabic text, escapes newlines and includes the link and alarm", () => {
    expect(unfolded).toContain("SUMMARY:فلتر ماء المطبخ");
    expect(unfolded).toContain("\\n");
    expect(unfolded).toContain("URL:https://timora.example/items/");
    expect(unfolded).toContain("BEGIN:VALARM");
    expect(unfolded).toContain("ACTION:DISPLAY");
  });

  it("uses CRLF line endings and folds long lines", () => {
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("uses an ASCII filename", () => {
    expect(calendarFileName("2026-12-15")).toBe("timora-2026-12-15.ics");
  });
});

describe("QR codes", () => {
  const url = qrUrl("https://timora.example", "a".repeat(64));

  it("encodes the scan URL", () => {
    expect(url).toBe(`https://timora.example/q/${"a".repeat(64)}`);
    const m = qrMatrix(url);
    expect(m.size).toBeGreaterThanOrEqual(25);
    expect(m.modules).toHaveLength(m.size * m.size);
  });

  it("renders finder patterns in the path and a self-contained SVG", () => {
    const d = qrPath(qrMatrix(url));
    expect(d.startsWith("M0 0h7")).toBe(true);
    const svg = qrSvg(url);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(svg).not.toMatch(/<script|on\w+=/i);
  });
});

describe("safe redirects", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/items/123?from=qr", "/items/123?from=qr"],
    [`/q/${"b".repeat(64)}`, `/q/${"b".repeat(64)}`],
  ])("allows %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/dashboard",
    "javascript:alert(1)",
    "/dashboard\n//evil",
    "/admin",
    "",
    null,
    "dashboard",
    "/%2F%2Fevil.example",
  ])("rejects %s", (input) => {
    expect(safeNextPath(input as string | null)).toBe("/dashboard");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window, then resets", () => {
    resetRateLimits();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i += 1) expect(rateLimit("k", 3, 1000, t0).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t0 + 10).ok).toBe(false);
    expect(rateLimit("k", 3, 1000, t0 + 1001).ok).toBe(true);
  });
});

describe("i18n", () => {
  it("uses all Arabic plural forms", () => {
    const f = ar.time.dueIn;
    expect(plural("ar", f, 1)).toBe("بعد يوم واحد");
    expect(plural("ar", f, 2)).toBe("بعد يومين");
    expect(plural("ar", f, 3)).toBe("بعد 3 أيام");
    expect(plural("ar", f, 11)).toBe("بعد 11 يومًا");
    expect(plural("ar", f, 100)).toBe("بعد 100 يوم");
    expect(plural("ar", ar.time.daysAgo, 0)).toBe("اليوم");
  });

  it("uses English one/other", () => {
    expect(plural("en", en.recurrence.month, 1)).toBe("Every month");
    expect(plural("en", en.recurrence.month, 6)).toBe("Every 6 months");
  });

  it("formats Gregorian dates with Latin digits without timezone shifts", () => {
    expect(formatLocalDate("en", "2026-01-01", "medium")).toBe("Jan 1, 2026");
    const arDate = formatLocalDate("ar", "2026-01-01", "long");
    expect(arDate).toContain("2026");
    expect(arDate).toContain("يناير");
  });

  it("interpolates without evaluating content", () => {
    expect(fmt("Hello {name}", { name: "<b>x</b>" })).toBe("Hello <b>x</b>");
    expect(fmt("{missing} stays")).toBe("{missing} stays");
  });

  it("defaults to Arabic unless English was chosen", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("ar")).toBe("ar");
    expect(resolveLocale(undefined)).toBe("ar");
    expect(resolveLocale("xx")).toBe("ar");
  });

  it("keeps both dictionaries structurally identical", () => {
    const shape = (o: unknown): unknown =>
      Array.isArray(o) ? o.map(shape) : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, shape((o as Record<string, unknown>)[k])])) : typeof o;
    const stripPluralForms = (o: unknown): unknown => {
      if (Array.isArray(o)) return o.map(stripPluralForms);
      if (o && typeof o === "object") {
        const obj = o as Record<string, unknown>;
        if ("other" in obj && typeof obj.other === "string") return "plural";
        return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, stripPluralForms(v)]));
      }
      return o;
    };
    expect(shape(stripPluralForms(en))).toEqual(shape(stripPluralForms(ar)));
  });
});

describe("item list helpers", () => {
  const row = (over: Partial<ItemOverview>): ItemOverview => ({
    id: crypto.randomUUID(),
    user_id: "u",
    category_id: null,
    name: "Item",
    note: null,
    icon: null,
    schedule_type: "interval",
    interval_count: 1,
    interval_unit: "month",
    due_date: null,
    due_soon_days: null,
    schedule_set_at: "2026-01-01T00:00:00Z",
    qr_token: "a".repeat(64),
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    category_system_key: null,
    category_name: null,
    category_icon: null,
    last_completed_on: "2026-09-01",
    latest_recorded_at: "2026-09-01T10:00:00Z",
    completion_count: 1,
    ...over,
  });
  const today = "2026-09-15";
  const views = [
    toItemView(row({ name: "فلتر الماء", last_completed_on: "2026-08-01" }), today), // overdue
    toItemView(row({ name: "مكيّف الصالة", last_completed_on: "2026-08-14" }), today), // due soon (Sep 14 → overdue by 1)
    toItemView(row({ name: "Plant", last_completed_on: "2026-09-10", note: "balcony" }), today), // good
    toItemView(row({ name: "Old car", archived_at: "2026-09-01T00:00:00Z" }), today),
  ];
  const items = views.map((v) => ({ ...v, categoryId: v.category_id, daysUntilDue: v.daysUntilDue, lastCompletedOn: v.last_completed_on, createdAt: v.created_at, text: { category: "" } }));

  it("normalises Arabic letter variants and diacritics", () => {
    expect(normalizeSearch("مُكَيِّف")).toBe("مكيف");
    expect(normalizeSearch("إطار السيارة")).toBe("اطار السياره");
  });

  it("hides archived items unless filtered explicitly", () => {
    expect(filterItems(items, {})).toHaveLength(3);
    expect(filterItems(items, { status: "archived" })).toHaveLength(1);
  });

  it("searches names and notes", () => {
    expect(filterItems(items, { q: "مكيف" }).map((i) => i.name)).toEqual(["مكيّف الصالة"]);
    expect(filterItems(items, { q: "BALCONY" }).map((i) => i.name)).toEqual(["Plant"]);
  });

  it("sorts by attention first", () => {
    const sorted = sortItems(filterItems(items, {}), "attention", "ar");
    expect(sorted.map((i) => i.status)).toEqual(["overdue", "overdue", "good"]);
    expect(sorted[0]!.name).toBe("فلتر الماء");
  });
});

describe("validation", () => {
  const today = "2026-09-15";
  const base = {
    name: "  Water filter ",
    categoryId: "",
    icon: "droplet",
    scheduleType: "interval",
    intervalCount: "3",
    intervalUnit: "month",
    dueDate: "",
    lastCompletedOn: "2026-09-01",
    dueSoonDays: "",
    note: "   ",
  };

  it("normalises a valid interval item", () => {
    const parsed = itemFormSchema(today).parse(base);
    expect(itemFormToColumns(parsed)).toEqual({
      name: "Water filter",
      category_id: null,
      icon: "droplet",
      note: null,
      schedule_type: "interval",
      interval_count: 3,
      interval_unit: "month",
      due_date: null,
      due_soon_days: null,
    });
  });

  it("rejects missing interval counts, future completions, unknown icons and long names", () => {
    const r = itemFormSchema(today).safeParse({ ...base, intervalCount: "", lastCompletedOn: "2026-09-16", icon: "<svg>", name: "x".repeat(81) });
    expect(r.success).toBe(false);
    const codes = r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
    expect(codes).toEqual(expect.arrayContaining(["name:tooLong", "intervalCount:intervalRange", "lastCompletedOn:futureDate"]));
    expect(codes.some((c) => c.startsWith("icon:"))).toBe(true);
  });

  it("requires a date for one-time items and clears interval columns", () => {
    expect(itemFormSchema(today).safeParse({ ...base, scheduleType: "once" }).success).toBe(false);
    const parsed = itemFormSchema(today).parse({ ...base, scheduleType: "once", dueDate: "2027-03-01" });
    expect(itemFormToColumns(parsed)).toMatchObject({ interval_count: null, interval_unit: null, due_date: "2027-03-01" });
  });

  it("validates completions and settings", () => {
    expect(completionSchema(today).safeParse({ itemId: crypto.randomUUID(), completedOn: "2026-09-16" }).success).toBe(false);
    expect(completionSchema(today).safeParse({ itemId: "1 or 1=1", completedOn: "2026-09-10" }).success).toBe(false);
    expect(settingsSchema.safeParse({ displayName: "", locale: "ar", timezone: "Asia/Riyadh", theme: "dark" }).success).toBe(true);
    expect(settingsSchema.safeParse({ displayName: "", locale: "fr", timezone: "Asia/Riyadh", theme: "dark" }).success).toBe(false);
    expect(settingsSchema.safeParse({ displayName: "", locale: "ar", timezone: "Mars/Base", theme: "dark" }).success).toBe(false);
  });
});

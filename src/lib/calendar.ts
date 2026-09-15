import { createEvent } from "ics";
import { addDays, parseLocalDate, type LocalDate } from "@/lib/domain/dates";

export type CalendarEventInput = {
  itemId: string;
  title: string;
  dueDate: LocalDate;
  description: string;
  url: string;
  alarmText: string;
};

const CRLF = "\r\n";

/**
 * Builds an all-day RFC 5545 event for the next due date. All-day (VALUE=DATE)
 * events keep the calendar date stable regardless of the importing device's timezone.
 * A display alarm fires at 09:00 on the day; calendars that ignore alarms on import
 * (e.g. some web calendars) still import the event itself.
 */
export function buildCalendarEvent(input: CalendarEventInput): string {
  const start = parseLocalDate(input.dueDate);
  const end = parseLocalDate(addDays(input.dueDate, 1));
  const { error, value } = createEvent({
    uid: `${input.itemId}-${input.dueDate}@timora.app`,
    productId: "timora/ics",
    title: input.title,
    description: input.description,
    url: input.url,
    start: [start.year, start.month, start.day],
    end: [end.year, end.month, end.day],
    status: "CONFIRMED",
    busyStatus: "FREE",
    transp: "TRANSPARENT",
    alarms: [{ action: "display", description: input.alarmText, trigger: { hours: 9, minutes: 0, before: false } }],
  });
  if (error || !value) {
    throw error ?? new Error("Could not build calendar event");
  }
  return foldIcsLines(value);
}

/**
 * RFC 5545 §3.1: content lines should be at most 75 octets, continued with CRLF + space.
 * Arabic characters take 2 bytes in UTF-8, so folding counts octets and never splits a code point.
 */
export function foldIcsLines(ics: string): string {
  const encoder = new TextEncoder();
  const lines = ics.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    let current = "";
    let bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) {
        out.push(current);
        current = " ";
        bytes = 1;
      }
      current += char;
      bytes += size;
    }
    out.push(current);
  }
  return out.join(CRLF);
}

/** A filesystem-safe ASCII filename; the item name itself stays inside the event. */
export function calendarFileName(dueDate: LocalDate): string {
  return `timora-${dueDate}.ics`;
}

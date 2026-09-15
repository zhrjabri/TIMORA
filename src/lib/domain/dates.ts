/**
 * Calendar-date helpers. Scheduling works on local calendar dates ("YYYY-MM-DD"),
 * never on instants, so a due date does not shift when a user travels or changes
 * timezone. Instants (timestamps) are stored in UTC and only converted for display.
 */

export type LocalDate = string; // YYYY-MM-DD

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 30;
}

export function isLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return y >= 1900 && y <= 9999 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(value);
  if (!m || !isLocalDate(value)) throw new Error(`Invalid local date: ${value}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toEpochDay(value: LocalDate): number {
  const { year, month, day } = parseLocalDate(value);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): LocalDate {
  const d = new Date(epochDay * MS_PER_DAY);
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(value: LocalDate, days: number): LocalDate {
  return fromEpochDay(toEpochDay(value) + days);
}

/**
 * Adds calendar months using the end-of-month clamp rule: the day of month is
 * kept when it exists in the target month, otherwise it becomes that month's last day.
 *   2026-01-31 + 1 month   → 2026-02-28
 *   2028-01-31 + 1 month   → 2028-02-29 (leap year)
 *   2026-03-31 + 1 month   → 2026-04-30
 *   2028-02-29 + 12 months → 2029-02-28
 * Next due dates are always computed from the anchor (the last completion), never
 * chained from a previous due date, so clamping never accumulates drift.
 */
export function addMonths(value: LocalDate, months: number): LocalDate {
  const { year, month, day } = parseLocalDate(value);
  const zeroBased = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (zeroBased % 12) + 1;
  return formatLocalDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date at `instant` as seen in `timeZone`. */
export function localDateInTimeZone(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

import { z } from "zod";
import { isLocalDate, isValidTimeZone } from "@/lib/domain/dates";
import { INTERVAL_UNITS, MAX_DUE_SOON_DAYS, MAX_INTERVAL_COUNT, SCHEDULE_TYPES } from "@/lib/domain/recurrence";
import { LOCALES, THEMES } from "@/i18n/config";
import { isIconKey } from "@/lib/icons";

/**
 * Validation error messages are stable codes, translated in the UI via `validation.*`.
 * The same schemas run in the browser (for instant feedback) and on the server (as the authority).
 */
export type ValidationCode =
  | "required"
  | "email"
  | "tooLong"
  | "passwordMin"
  | "invalidDate"
  | "futureDate"
  | "intervalRange"
  | "dueSoonRange"
  | "timezone";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, { message: "tooLong" }).nullable());

const localDate = z.string().refine(isLocalDate, { message: "invalidDate" });

const optionalInt = (min: number, max: number, message: ValidationCode) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v),
    z.number({ message }).int({ message }).min(min, { message }).max(max, { message }).nullable(),
  );

export const uuidSchema = z.uuid();

export function itemFormSchema(today: string) {
  return z
    .object({
      name: z.string().trim().min(1, { message: "required" }).max(80, { message: "tooLong" }),
      categoryId: z.preprocess(emptyToNull, z.uuid().nullable()),
      icon: z.preprocess(emptyToNull, z.string().refine(isIconKey).nullable()),
      scheduleType: z.enum(SCHEDULE_TYPES),
      intervalCount: optionalInt(1, MAX_INTERVAL_COUNT, "intervalRange"),
      intervalUnit: z.enum(INTERVAL_UNITS),
      dueDate: z.preprocess(emptyToNull, localDate.nullable()),
      lastCompletedOn: z.preprocess(emptyToNull, localDate.nullable()),
      dueSoonDays: optionalInt(0, MAX_DUE_SOON_DAYS, "dueSoonRange"),
      note: optionalText(1000),
    })
    .superRefine((value, ctx) => {
      if (value.scheduleType === "interval" && value.intervalCount === null) {
        ctx.addIssue({ code: "custom", path: ["intervalCount"], message: "intervalRange" });
      }
      if (value.scheduleType === "once" && value.dueDate === null) {
        ctx.addIssue({ code: "custom", path: ["dueDate"], message: "required" });
      }
      if (value.lastCompletedOn && value.lastCompletedOn > today) {
        ctx.addIssue({ code: "custom", path: ["lastCompletedOn"], message: "futureDate" });
      }
    });
}

/** Raw form state: every input is a string until the schema parses it. */
export type ItemFormValues = {
  name: string;
  categoryId: string;
  icon: string;
  scheduleType: (typeof SCHEDULE_TYPES)[number];
  intervalCount: string;
  intervalUnit: (typeof INTERVAL_UNITS)[number];
  dueDate: string;
  lastCompletedOn: string;
  dueSoonDays: string;
  note: string;
};
export type ItemFormData = z.output<ReturnType<typeof itemFormSchema>>;

/** Maps validated form data onto the database columns, enforcing the schedule shape. */
export function itemFormToColumns(data: ItemFormData) {
  return {
    name: data.name,
    category_id: data.categoryId,
    icon: data.icon,
    note: data.note,
    schedule_type: data.scheduleType,
    interval_count: data.scheduleType === "interval" ? data.intervalCount : null,
    interval_unit: data.scheduleType === "interval" ? data.intervalUnit : null,
    due_date: data.scheduleType === "once" ? data.dueDate : null,
    due_soon_days: data.scheduleType === "none" ? null : data.dueSoonDays,
  };
}

export function completionSchema(today: string) {
  return z.object({
    itemId: z.uuid(),
    completedOn: localDate.refine((d) => d <= today, { message: "futureDate" }),
    note: optionalText(500),
  });
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, { message: "required" }).max(40, { message: "tooLong" }),
  icon: z.preprocess(emptyToNull, z.string().refine(isIconKey).nullable()),
});

export const settingsSchema = z.object({
  displayName: optionalText(80),
  locale: z.enum(LOCALES),
  timezone: z.string().refine(isValidTimeZone, { message: "timezone" }),
  theme: z.enum(THEMES),
});

export const emailSchema = z.email({ message: "email" }).max(254, { message: "tooLong" });
export const passwordSchema = z.string().min(8, { message: "passwordMin" }).max(72, { message: "tooLong" });

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, { message: "required" }) });
export const signUpSchema = z.object({ email: emailSchema, password: passwordSchema });
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ password: passwordSchema });

export const QR_TOKEN_RE = /^[0-9a-f]{64}$/;

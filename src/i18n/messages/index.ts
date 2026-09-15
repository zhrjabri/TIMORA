import type { Locale } from "../config";
import { ar } from "./ar";
import { en } from "./en";

export type Messages = typeof ar;

const dictionaries: Record<Locale, Messages> = { ar, en };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

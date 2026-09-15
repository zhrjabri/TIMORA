import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserToday } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import { toItemView, type ItemView } from "./view";
import type { Category, CompletionRecord } from "@/lib/database.types";

export const listItemViews = cache(async (): Promise<ItemView[]> => {
  const [{ today }, supabase] = await Promise.all([getUserToday(), createClient()]);
  const { data, error } = await supabase.from("item_overview").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []).map((row) => toItemView(row, today));
});

export const getItemView = cache(async (id: string): Promise<ItemView | null> => {
  const [{ today }, supabase] = await Promise.all([getUserToday(), createClient()]);
  const { data, error } = await supabase.from("item_overview").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toItemView(data, today) : null;
});

export const listCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
});

export async function listHistory(itemId: string, limit = 500): Promise<CompletionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("completion_records")
    .select("*")
    .eq("item_id", itemId)
    .order("completed_on", { ascending: false })
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentCompletions(days = 14, limit = 6): Promise<CompletionRecord[]> {
  const [{ today }, supabase] = await Promise.all([getUserToday(), createClient()]);
  const { data, error } = await supabase
    .from("completion_records")
    .select("*")
    .is("undone_at", null)
    .gte("completed_on", addDays(today, -days))
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

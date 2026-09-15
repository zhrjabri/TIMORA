"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUserToday } from "@/lib/auth";
import { guardMutation } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { completionSchema, itemFormSchema, itemFormToColumns, uuidSchema } from "@/lib/validation/schemas";
import { toItemView } from "@/lib/items/view";

function revalidateItem(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/items");
  if (id) {
    revalidatePath(`/items/${id}`);
    revalidatePath(`/items/${id}/history`);
  }
}

export async function createItemAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await guardMutation("item-write");
  if ("error" in guard) return fail(guard.error);

  const { today } = await getUserToday();
  const parsed = itemFormSchema(today).safeParse(values);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: item, error } = await supabase.from("items").insert(itemFormToColumns(parsed.data)).select("id").single();
  if (error || !item) return fail(fromDbError(error));

  if (parsed.data.lastCompletedOn) {
    const { error: completionError } = await supabase
      .from("completion_records")
      .insert({ item_id: item.id, completed_on: parsed.data.lastCompletedOn, source: "initial" });
    if (completionError) {
      // Keep creation atomic from the user's point of view.
      await supabase.from("items").delete().eq("id", item.id);
      return fail(fromDbError(completionError));
    }
  }

  revalidateItem(item.id);
  return ok({ id: item.id });
}

export async function updateItemAction(id: string, values: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await guardMutation("item-write");
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(id).success) return fail("not_found");

  const { today } = await getUserToday();
  const parsed = itemFormSchema(today).safeParse(values);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("items").update(itemFormToColumns(parsed.data)).eq("id", id).select("id").maybeSingle();
  if (error) return fail(fromDbError(error));
  if (!data) return fail("not_found");

  revalidateItem(id);
  return ok({ id });
}

export async function setArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const guard = await guardMutation("item-write");
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(id).success || typeof archived !== "boolean") return fail("invalid");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return fail(fromDbError(error));
  if (!data) return fail("not_found");

  revalidateItem(id);
  return ok(null);
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  const guard = await guardMutation("item-delete", 30);
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(id).success) return fail("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase.from("items").delete().eq("id", id).select("id").maybeSingle();
  if (error) return fail(fromDbError(error));
  if (!data) return fail("not_found");

  revalidateItem();
  return ok(null);
}

const completeInputSchema = z.object({
  itemId: z.uuid(),
  completedOn: z.string().optional(),
  note: z.string().optional().nullable(),
  source: z.enum(["done_now", "qr", "backdated"]).default("done_now"),
});

export type CompleteResult = { recordId: string; nextDue: string | null; itemName: string };

export async function completeItemAction(input: unknown): Promise<ActionResult<CompleteResult>> {
  const guard = await guardMutation("complete", 30);
  if ("error" in guard) return fail(guard.error);

  const base = completeInputSchema.safeParse(input);
  if (!base.success) return fromZod(base.error);

  const { today } = await getUserToday();
  const completedOn = base.data.completedOn || today;
  const source = base.data.source === "backdated" && completedOn === today ? "done_now" : base.data.source;
  const parsed = completionSchema(today).safeParse({ itemId: base.data.itemId, completedOn, note: base.data.note ?? null });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data: record, error } = await supabase
    .from("completion_records")
    .insert({ item_id: parsed.data.itemId, completed_on: parsed.data.completedOn, note: parsed.data.note, source })
    .select("id")
    .single();
  if (error || !record) return fail(fromDbError(error));

  const { data: row } = await supabase.from("item_overview").select("*").eq("id", parsed.data.itemId).maybeSingle();
  const view = row ? toItemView(row, today) : null;

  revalidateItem(parsed.data.itemId);
  return ok({ recordId: record.id, nextDue: view?.nextDue ?? null, itemName: view?.name ?? "" });
}

export async function undoCompletionAction(recordId: string): Promise<ActionResult<{ itemId: string }>> {
  const guard = await guardMutation("complete", 30);
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(recordId).success) return fail("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("completion_records")
    .update({ undone_at: new Date().toISOString() })
    .eq("id", recordId)
    .is("undone_at", null)
    .select("item_id")
    .maybeSingle();
  if (error) return fail(fromDbError(error));
  if (!data) return fail("not_found");

  revalidateItem(data.item_id);
  return ok({ itemId: data.item_id });
}

export async function regenerateQrAction(itemId: string): Promise<ActionResult> {
  const guard = await guardMutation("qr-rotate", 10);
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(itemId).success) return fail("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("regenerate_qr_token", { p_item_id: itemId });
  if (error) return fail(fromDbError(error));

  revalidatePath(`/items/${itemId}`);
  revalidatePath(`/items/${itemId}/label`);
  return ok(null);
}

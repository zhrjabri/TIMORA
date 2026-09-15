"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guardMutation } from "@/lib/actions/guard";
import { fail, fromDbError, fromZod, ok, type ActionResult } from "@/lib/actions/result";
import { categorySchema, uuidSchema } from "@/lib/validation/schemas";

function revalidateCategories() {
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  revalidatePath("/items");
}

export async function createCategoryAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  const guard = await guardMutation("category-write");
  if ("error" in guard) return fail(guard.error);
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").insert({ name: parsed.data.name, icon: parsed.data.icon }).select("id").single();
  if (error || !data) return fail(fromDbError(error));

  revalidateCategories();
  return ok({ id: data.id });
}

export async function updateCategoryAction(id: string, values: unknown): Promise<ActionResult> {
  const guard = await guardMutation("category-write");
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(id).success) return fail("not_found");
  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ name: parsed.data.name, icon: parsed.data.icon })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return fail(fromDbError(error));
  if (!data) return fail("not_found");

  revalidateCategories();
  return ok(null);
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const guard = await guardMutation("category-write");
  if ("error" in guard) return fail(guard.error);
  if (!uuidSchema.safeParse(id).success) return fail("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id").maybeSingle();
  if (error) return fail(fromDbError(error));
  if (!data) return fail("not_found");

  revalidateCategories();
  return ok(null);
}

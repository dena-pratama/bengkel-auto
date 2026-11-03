"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  createStockOpnameSchema,
  postStockOpnameSchema,
  saveCountsSchema,
  voidStockOpnameSchema,
  type CreateStockOpnameInput,
  type PostStockOpnameInput,
  type SaveCountsInput,
  type VoidStockOpnameInput,
} from "@/lib/validation/stock-opname";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "stok opname");

const refresh = (id?: string) => {
  revalidatePath("/stok-opname", "layout");
  if (id) revalidatePath(`/stok-opname/${id}`);
  revalidatePath("/inventory", "layout");
};

const isUuid = (v: string) => z.string().uuid().safeParse(v).success;
const bad = { ok: false as const, error: "ID dokumen tidak valid." };

export async function createStockOpnameAction(
  input: CreateStockOpnameInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createStockOpnameSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const scopeFilter: Record<string, unknown> = {};
  if (parsed.data.opname_type === "location" && parsed.data.location_ids?.length) {
    scopeFilter.location_ids = parsed.data.location_ids;
  } else if (parsed.data.opname_type === "category" && parsed.data.category_ids?.length) {
    scopeFilter.category_ids = parsed.data.category_ids;
  } else if (parsed.data.opname_type === "cycle_count") {
    scopeFilter.sample_size = parsed.data.sample_size || 20;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stock_opname", {
    p_data: {
      opname_type: parsed.data.opname_type,
      is_blind_count: parsed.data.is_blind_count,
      assigned_to: parsed.data.assigned_to || null,
      notes: parsed.data.notes || null,
      scope_filter: scopeFilter,
    },
  });

  if (error) return dbError(error);
  const id = data as string;
  refresh(id);
  return done({ id });
}

export async function startStockOpnameAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_stock_opname", { p_opname_id: id });
  if (error) return dbError(error);
  refresh(id);
  return done();
}

export async function saveOpnameCountsAction(input: SaveCountsInput): Promise<ActionResult> {
  const parsed = saveCountsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_opname_counts", {
    p_opname_id: parsed.data.opname_id,
    p_counts: parsed.data.counts,
  });

  if (error) return dbError(error);
  refresh(parsed.data.opname_id);
  return done();
}

export async function completeOpnameCountAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_opname_count", { p_opname_id: id });
  if (error) return dbError(error);
  refresh(id);
  return done();
}

export async function recountOpnameItemAction(
  opnameId: string,
  itemRowId: string,
): Promise<ActionResult> {
  if (!isUuid(opnameId) || !isUuid(itemRowId)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("recount_opname_item", { p_item_row_id: itemRowId });
  if (error) return dbError(error);
  refresh(opnameId);
  return done();
}

export async function postStockOpnameAction(
  input: PostStockOpnameInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = postStockOpnameSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_stock_opname", {
    p_opname_id: parsed.data.opname_id,
    p_pin: parsed.data.pin || null,
    p_items_reasons: parsed.data.items_reasons || null,
  });

  if (error) return dbError(error);
  refresh(parsed.data.opname_id);
  return done({ id: data as string });
}

export async function voidStockOpnameAction(input: VoidStockOpnameInput): Promise<ActionResult> {
  const parsed = voidStockOpnameSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_stock_opname", {
    p_opname_id: parsed.data.opname_id,
    p_reason: parsed.data.reason,
  });

  if (error) return dbError(error);
  refresh(parsed.data.opname_id);
  return done();
}

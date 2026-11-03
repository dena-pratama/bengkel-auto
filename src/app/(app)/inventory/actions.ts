"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  itemSchema,
  openingStockSchema,
  packageSchema,
  serviceSchema,
  transferSchema,
  type ItemInput,
  type OpeningStockInput,
  type PackageInput,
  type ServiceInput,
  type TransferInput,
} from "@/lib/validation/inventory";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "inventory");
const refresh = () => revalidatePath("/inventory", "layout");

export async function saveItemAction(id: string | null, input: ItemInput): Promise<ActionResult<{ id: string }>> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { units, part_numbers, ...data } = parsed.data;

  const supabase = await createClient();
  const { data: itemId, error } = await supabase.rpc("save_item", {
    p_id: id,
    p_data: data,
    p_units: units,
    p_part_numbers: part_numbers,
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: itemId as string });
}

export async function saveServiceAction(id: string | null, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_service", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function savePackageAction(id: string | null, input: PackageInput): Promise<ActionResult<{ id: string }>> {
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { items, ...data } = parsed.data;
  const supabase = await createClient();
  const { data: pkgId, error } = await supabase.rpc("save_package", {
    p_id: id,
    p_data: data,
    p_items: items.map((c) => (c.kind === "item" ? { item_id: c.id, qty: c.qty } : { service_id: c.id, qty: c.qty })),
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: pkgId as string });
}

const MASTER_TABLES = ["item_categories", "brands", "units", "locations", "items", "service_categories", "services", "packages"] as const;

export async function setActiveAction(table: (typeof MASTER_TABLES)[number], id: string, active: boolean): Promise<ActionResult> {
  if (!MASTER_TABLES.includes(table) || !z.uuid().safeParse(id).success) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_master_active", { p_table: table, p_id: id, p_active: active });
  if (error) return dbError(error);
  refresh();
  return done();
}

// ---------------------------------------------------------------------------- Master kecil

const name = (label: string, max = 60) => z.string().trim().min(1, `${label} wajib diisi`).max(max, `Maksimal ${max} karakter`);
const optionalUuid = z.string().refine((v) => v === "" || z.uuid().safeParse(v).success, "Pilihan tidak valid");

const masterSchemas = {
  category: z.object({ name: name("Nama kategori").min(2, "Minimal 2 karakter"), parent_id: optionalUuid }),
  brand: z.object({ name: name("Nama merek") }),
  unit: z.object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9]{1,10}$/, "Kode 1–10 huruf kecil/angka, contoh pcs"),
    name: name("Nama satuan", 40),
  }),
  location: z.object({
    parent_id: optionalUuid,
    type: z.enum(["area", "rack", "bin"]),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,19}$/, "Kode hanya huruf, angka, tanda minus"),
    name: name("Nama lokasi"),
  }),
  service_category: z.object({ name: name("Nama kategori").min(2, "Minimal 2 karakter") }),
};
export type MasterKind = keyof typeof masterSchemas;

export async function saveMasterAction(kind: MasterKind, id: string | null, input: Record<string, string>): Promise<ActionResult<{ id: string }>> {
  const schema = masterSchemas[kind];
  if (!schema) return { ok: false, error: "Jenis data tidak dikenal." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const v = parsed.data as Record<string, string>;
  const parent = v.parent_id ? v.parent_id : null;

  const supabase = await createClient();
  const call =
    kind === "category"
      ? supabase.rpc("save_item_category", { p_id: id, p_name: v.name, p_parent_id: parent })
      : kind === "brand"
        ? supabase.rpc("save_brand", { p_id: id, p_name: v.name })
        : kind === "unit"
          ? supabase.rpc("save_unit", { p_id: id, p_code: v.code, p_name: v.name })
          : kind === "location"
            ? supabase.rpc("save_location", { p_id: id, p_parent_id: parent, p_type: v.type, p_code: v.code, p_name: v.name })
            : supabase.rpc("save_service_category", { p_id: id, p_name: v.name });
  const { data, error } = await call;
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

// ---------------------------------------------------------------------------- Stok

export async function postOpeningStockAction(itemId: string, input: OpeningStockInput): Promise<ActionResult> {
  const parsed = openingStockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("post_opening_stock", {
    p_item_id: itemId,
    p_location_id: parsed.data.location_id,
    p_qty: parsed.data.qty,
    p_unit_cost: parsed.data.unit_cost,
    p_note: parsed.data.note || null,
  });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function transferStockAction(itemId: string, input: TransferInput): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_stock", {
    p_item_id: itemId,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_qty: parsed.data.qty,
    p_note: parsed.data.note || null,
  });
  if (error) return dbError(error);
  refresh();
  return done();
}

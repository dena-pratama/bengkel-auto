import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OpnameStatus, OpnameType, VarianceReason } from "@/lib/validation/stock-opname";

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}

const num = (v: unknown) => Number(v ?? 0);

export type StockOpnameRow = {
  id: string;
  branch_id: string;
  branch_name: string;
  opname_no: string;
  opname_type: OpnameType;
  status: OpnameStatus;
  is_blind_count: boolean;
  scope_filter: Record<string, unknown>;
  assigned_to: string | null;
  assigned_name: string | null;
  notes: string | null;
  total_items: number;
  matched_items: number;
  variance_items: number;
  total_variance_amount: number;
  accuracy_pct: number;
  started_at: string | null;
  counted_at: string | null;
  completed_at: string | null;
  approved_by: string | null;
  approved_name: string | null;
  approved_at: string | null;
  journal_id: string | null;
  journal_no: string | null;
  void_reason: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  updated_at: string;
};

export type StockOpnameItemRow = {
  id: string;
  opname_id: string;
  item_id: string;
  item_sku: string;
  item_name: string;
  category_name: string | null;
  unit_code: string;
  unit_name: string;
  location_id: string;
  location_code: string;
  location_name: string;
  system_qty: number;
  physical_qty: number | null;
  difference_qty: number;
  cost_price: number;
  difference_amount: number;
  variance_reason: VarianceReason | null;
  notes: string | null;
  counted_at: string | null;
  counted_by: string | null;
  counted_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type StockOpnameDetail = StockOpnameRow & {
  items: StockOpnameItemRow[];
};

const toOpname = (r: StockOpnameRow): StockOpnameRow => ({
  ...r,
  total_items: num(r.total_items),
  matched_items: num(r.matched_items),
  variance_items: num(r.variance_items),
  total_variance_amount: num(r.total_variance_amount),
  accuracy_pct: num(r.accuracy_pct),
});

const toOpnameItem = (r: StockOpnameItemRow): StockOpnameItemRow => ({
  ...r,
  system_qty: num(r.system_qty),
  physical_qty: r.physical_qty === null || r.physical_qty === undefined ? null : num(r.physical_qty),
  difference_qty: num(r.difference_qty),
  cost_price: num(r.cost_price),
  difference_amount: num(r.difference_amount),
});

export async function listStockOpnames(): Promise<StockOpnameRow[]> {
  const s = await createClient();
  const res = await s
    .from("v_stock_opnames")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  return must<StockOpnameRow[]>(res, "daftar stok opname").map(toOpname);
}

export async function getStockOpname(id: string): Promise<StockOpnameDetail | null> {
  const s = await createClient();
  const [headRes, itemsRes] = await Promise.all([
    s.from("v_stock_opnames").select("*").eq("id", id).maybeSingle(),
    s.from("v_stock_opname_items").select("*").eq("opname_id", id).order("location_code").order("item_name"),
  ]);

  if (headRes.error) throw new Error(`Gagal memuat detail opname: ${headRes.error.message}`);
  if (!headRes.data) return null;

  const head = toOpname(headRes.data as StockOpnameRow);
  const items = must<StockOpnameItemRow[]>(itemsRes, "daftar barang opname").map(toOpnameItem);

  return {
    ...head,
    items,
  };
}

export type StorageLocationRef = {
  id: string;
  code: string;
  name: string;
  type: string;
};

export async function listOpnameLocations(): Promise<StorageLocationRef[]> {
  const s = await createClient();
  const res = await s
    .from("locations")
    .select("id, code, name, type")
    .eq("is_active", true)
    .order("code");
  return must<StorageLocationRef[]>(res, "lokasi rak gudang");
}

export type CategoryRef = {
  id: string;
  name: string;
};

export async function listOpnameCategories(): Promise<CategoryRef[]> {
  const s = await createClient();
  const res = await s
    .from("item_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  return must<CategoryRef[]>(res, "kategori barang");
}

export type EmployeeRef = {
  id: string;
  code: string;
  full_name: string;
};

export async function listOpnameEmployees(): Promise<EmployeeRef[]> {
  const s = await createClient();
  const res = await s
    .from("employees")
    .select("id, code, full_name")
    .eq("status", "active")
    .order("full_name");
  return must<EmployeeRef[]>(res, "karyawan");
}

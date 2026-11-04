import "server-only";
import { parseQr } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

// Hasil scan QR (PRD §4.3): barang atau rak. Hanya membaca; mengikuti RLS pengguna.

export type ScanItem = {
  kind: "item";
  id: string;
  sku: string;
  name: string;
  unit: string;
  sell_price: number;
  min_stock: number;
  is_active: boolean;
  total_qty: number;
  locations: { location_id: string; code: string; name: string; qty: number }[];
  movements: { id: string; movement_type: string; qty: number; location_code: string; created_at: string }[];
};

export type ScanLocation = {
  kind: "location";
  id: string;
  code: string;
  name: string;
  type: string;
  items: { item_id: string; sku: string; name: string; unit: string; qty: number }[];
};

export type ScanResult = ScanItem | ScanLocation | { kind: "invalid" } | { kind: "notfound"; code: string };

const num = (v: unknown) => Number(v ?? 0);

async function findItem(code: string): Promise<ScanItem | null> {
  const s = await createClient();
  const { data: it, error } = await s
    .from("items")
    .select("id, sku, name, sell_price, min_stock, is_active, units!items_base_unit_id_fkey(code)")
    .eq("sku", code)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat barang: ${error.message}`);
  if (!it) return null;
  const [bal, mov] = await Promise.all([
    s.from("stock_balances").select("location_id, qty, locations(code, name)").eq("item_id", it.id).neq("qty", 0),
    s.from("stock_movements").select("id, movement_type, qty, created_at, locations(code)").eq("item_id", it.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (bal.error) throw new Error(`Gagal memuat stok: ${bal.error.message}`);
  if (mov.error) throw new Error(`Gagal memuat mutasi: ${mov.error.message}`);
  type Bal = { location_id: string; qty: number; locations: { code: string; name: string } | null };
  type Mov = { id: string; movement_type: string; qty: number; created_at: string; locations: { code: string } | null };
  const locations = (bal.data as unknown as Bal[]).map((b) => ({ location_id: b.location_id, code: b.locations?.code ?? "-", name: b.locations?.name ?? "-", qty: num(b.qty) }));
  return {
    kind: "item",
    id: it.id as string,
    sku: it.sku as string,
    name: it.name as string,
    unit: (it.units as unknown as { code: string } | null)?.code ?? "pcs",
    sell_price: num(it.sell_price),
    min_stock: num(it.min_stock),
    is_active: it.is_active as boolean,
    total_qty: locations.reduce((t, l) => t + l.qty, 0),
    locations: locations.sort((a, b) => a.code.localeCompare(b.code, "id")),
    movements: (mov.data as unknown as Mov[]).map((m) => ({ id: m.id, movement_type: m.movement_type, qty: num(m.qty), location_code: m.locations?.code ?? "-", created_at: m.created_at })),
  };
}

async function findLocation(code: string): Promise<ScanLocation | null> {
  const s = await createClient();
  const { data: loc, error } = await s.from("locations").select("id, code, name, type").eq("code", code).maybeSingle();
  if (error) throw new Error(`Gagal memuat lokasi: ${error.message}`);
  if (!loc) return null;
  const { data, error: e2 } = await s.from("stock_balances").select("item_id, qty, items(sku, name, units!items_base_unit_id_fkey(code))").eq("location_id", loc.id).neq("qty", 0);
  if (e2) throw new Error(`Gagal memuat isi rak: ${e2.message}`);
  type Row = { item_id: string; qty: number; items: { sku: string; name: string; units: { code: string } | null } | null };
  return {
    kind: "location",
    id: loc.id as string,
    code: loc.code as string,
    name: loc.name as string,
    type: loc.type as string,
    items: (data as unknown as Row[])
      .map((r) => ({ item_id: r.item_id, sku: r.items?.sku ?? "-", name: r.items?.name ?? "Barang", unit: r.items?.units?.code ?? "pcs", qty: num(r.qty) }))
      .sort((a, b) => a.name.localeCompare(b.name, "id")),
  };
}

export async function resolveScan(raw: string): Promise<ScanResult> {
  const t = parseQr(raw);
  if (!t) return { kind: "invalid" };
  if (t.kind !== "location") {
    const item = await findItem(t.code);
    if (item) return item;
  }
  if (t.kind !== "item") {
    const loc = await findLocation(t.code);
    if (loc) return loc;
  }
  return { kind: "notfound", code: t.code };
}

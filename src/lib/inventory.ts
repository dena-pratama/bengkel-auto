import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca data master & stok (RLS menyaring per cabang; HPP hanya untuk izin laporan keuangan).

export type Category = { id: string; name: string; parent_id: string | null; is_active: boolean };
export type Brand = { id: string; name: string; is_active: boolean };
export type Unit = { id: string; code: string; name: string; is_active: boolean };
export type LocationType = "area" | "rack" | "bin";
export type Location = { id: string; parent_id: string | null; type: LocationType; code: string; name: string; is_active: boolean; path: string };
export type ServiceCategory = { id: string; name: string; is_active: boolean };

async function db() {
  return createClient();
}

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}

export async function listCategories(): Promise<Category[]> {
  const s = await db();
  return must(await s.from("item_categories").select("id, name, parent_id, is_active").order("name"), "kategori");
}

export async function listBrands(): Promise<Brand[]> {
  const s = await db();
  return must(await s.from("brands").select("id, name, is_active").order("name"), "merek");
}

export async function listUnits(): Promise<Unit[]> {
  const s = await db();
  return must(await s.from("units").select("id, code, name, is_active").order("code"), "satuan");
}

export async function listServiceCategories(): Promise<ServiceCategory[]> {
  const s = await db();
  return must(await s.from("service_categories").select("id, name, is_active").order("name"), "kategori jasa");
}

/** Lokasi dengan jalur lengkap (Area › Rak › Bin), urut sesuai pohon */
export async function listLocations(): Promise<Location[]> {
  const s = await db();
  const rows: Omit<Location, "path">[] = must(
    await s.from("locations").select("id, parent_id, type, code, name, is_active").order("code"),
    "lokasi",
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pathOf = (r: Omit<Location, "path">): string => {
    const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
    return parent ? `${pathOf(parent)} › ${r.code}` : r.code;
  };
  return rows.map((r) => ({ ...r, path: pathOf(r) })).sort((a, b) => a.path.localeCompare(b.path, "id"));
}

/** Label kategori "Induk › Sub" */
export function categoryLabel(categories: Category[], id: string | null) {
  const c = categories.find((x) => x.id === id);
  if (!c) return null;
  const parent = categories.find((x) => x.id === c.parent_id);
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

// ---------------------------------------------------------------------------- Barang

export type ItemListRow = {
  id: string;
  sku: string;
  name: string;
  is_active: boolean;
  sell_price: number;
  min_stock: number;
  category_id: string | null;
  category: string | null;
  brand: string | null;
  unit: string;
  part_numbers: string[];
  /** Kendaraan yang cocok, mis. "Toyota Avanza 2012-2018" (untuk pencarian) */
  compat: string[];
  qty: number;
};

export async function listItems(): Promise<ItemListRow[]> {
  const s = await db();
  const [items, stock, categories] = await Promise.all([
    s
      .from("items")
      .select("id, sku, name, is_active, sell_price, min_stock, category_id, brands(name), units!items_base_unit_id_fkey(code), item_part_numbers(part_number), item_compatibilities(year_from, year_to, vehicle_models(name, vehicle_makes(name)))")
      .order("name"),
    s.from("v_stock_on_hand").select("item_id, qty"),
    listCategories(),
  ]);
  type Row = Omit<ItemListRow, "category" | "brand" | "unit" | "part_numbers" | "compat" | "qty"> & {
    brands: { name: string } | null;
    units: { code: string };
    item_part_numbers: { part_number: string }[];
    item_compatibilities: { year_from: number | null; year_to: number | null; vehicle_models: { name: string; vehicle_makes: { name: string } | null } | null }[];
  };
  const qty = new Map(must(stock, "stok").map((r: { item_id: string; qty: number }) => [r.item_id, Number(r.qty)]));
  return (must(items, "barang") as unknown as Row[]).map(({ brands, units, item_part_numbers, item_compatibilities, ...r }) => ({
    ...r,
    sell_price: Number(r.sell_price),
    min_stock: Number(r.min_stock),
    category: categoryLabel(categories, r.category_id),
    brand: brands?.name ?? null,
    unit: units.code,
    part_numbers: item_part_numbers.map((p) => p.part_number),
    compat: item_compatibilities.map((c) => compatLabel(c.vehicle_models?.vehicle_makes?.name, c.vehicle_models?.name, c.year_from, c.year_to)),
    qty: qty.get(r.id) ?? 0,
  }));
}

export const compatLabel = (make: string | null | undefined, model: string | null | undefined, from: number | null, to: number | null) =>
  [make, model, from && to ? `${from}-${to}` : from ? `${from}+` : to ? `sampai ${to}` : null].filter(Boolean).join(" ");

export type ItemCompat = { make: string; model: string; year_from: number | null; year_to: number | null; engine: string | null };

/** Kendaraan yang cocok untuk satu barang */
export async function getItemCompat(itemId: string): Promise<ItemCompat[]> {
  const s = await db();
  type Row = { year_from: number | null; year_to: number | null; engine: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } | null } | null };
  const rows = must(
    await s.from("item_compatibilities").select("year_from, year_to, engine, vehicle_models(name, vehicle_makes(name))").eq("item_id", itemId).order("created_at"),
    "kompatibilitas",
  ) as unknown as Row[];
  return rows.map((r) => ({ make: r.vehicle_models?.vehicle_makes?.name ?? "", model: r.vehicle_models?.name ?? "", year_from: r.year_from, year_to: r.year_to, engine: r.engine }));
}

/** Merek dan model yang sudah dikenal (saran isian) */
export async function listVehicleModels(): Promise<{ make: string; model: string }[]> {
  const s = await db();
  type Row = { name: string; vehicle_makes: { name: string } | null };
  const rows = must(await s.from("vehicle_models").select("name, vehicle_makes(name)").order("name"), "model kendaraan") as unknown as Row[];
  return rows.map((r) => ({ make: r.vehicle_makes?.name ?? "", model: r.name })).filter((r) => r.make);
}

export type ItemDetail = {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  base_unit_id: string;
  sell_price: number;
  min_stock: number;
  default_location_id: string | null;
  warranty_days: number;
  is_taxable: boolean;
  notes: string | null;
  is_active: boolean;
  unit: string;
  units: { unit_id: string; code: string; factor: number; is_purchase: boolean; is_sale: boolean }[];
  part_numbers: { part_number: string; is_oem: boolean }[];
  has_movements: boolean;
};

export async function getItem(id: string): Promise<ItemDetail | null> {
  const s = await db();
  const res = await s
    .from("items")
    .select(
      "id, sku, name, category_id, brand_id, base_unit_id, sell_price, min_stock, default_location_id, warranty_days, is_taxable, notes, is_active, units!items_base_unit_id_fkey(code), item_units(unit_id, factor, is_purchase, is_sale, units(code)), item_part_numbers(part_number, is_oem)",
    )
    .eq("id", id)
    .maybeSingle();
  const row = must(res, "barang") as unknown as
    | (Omit<ItemDetail, "unit" | "units" | "part_numbers" | "has_movements"> & {
        units: { code: string };
        item_units: { unit_id: string; factor: number; is_purchase: boolean; is_sale: boolean; units: { code: string } }[];
        item_part_numbers: { part_number: string; is_oem: boolean }[];
      })
    | null;
  if (!row) return null;
  const moved = await s.from("stock_movements").select("id", { count: "exact", head: true }).eq("item_id", id);
  const { units, item_units, item_part_numbers, ...item } = row;
  return {
    ...item,
    sell_price: Number(item.sell_price),
    min_stock: Number(item.min_stock),
    unit: units.code,
    units: item_units.map((u) => ({ unit_id: u.unit_id, code: u.units.code, factor: Number(u.factor), is_purchase: u.is_purchase, is_sale: u.is_sale })),
    part_numbers: item_part_numbers,
    has_movements: (moved.count ?? 0) > 0,
  };
}

export type StockBalance = { location_id: string; qty: number };
export type StockMovement = {
  id: string;
  location_id: string;
  movement_type: string;
  qty: number;
  note: string | null;
  source_type: string | null;
  created_at: string;
};

export async function getItemStock(id: string) {
  const s = await db();
  const [balances, movements, prices, cost] = await Promise.all([
    s.from("stock_balances").select("location_id, qty").eq("item_id", id).neq("qty", 0),
    // Tanpa unit_cost: kolom HPP tidak diberikan ke pengguna biasa
    s
      .from("stock_movements")
      .select("id, location_id, movement_type, qty, note, source_type, created_at")
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    s
      .from("price_history")
      .select("id, old_price, new_price, created_at")
      .eq("entity_type", "item")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    s.from("item_costs").select("avg_cost").eq("item_id", id).maybeSingle(),
  ]);
  return {
    balances: must(balances, "saldo stok").map((b: StockBalance) => ({ ...b, qty: Number(b.qty) })),
    movements: must(movements, "mutasi").map((m: StockMovement) => ({ ...m, qty: Number(m.qty) })),
    prices: must(prices, "riwayat harga") as { id: string; old_price: number | null; new_price: number; created_at: string }[],
    // null = tidak punya izin melihat HPP
    avgCost: cost.data ? Number(cost.data.avg_cost) : null,
  };
}

// ---------------------------------------------------------------------------- Jasa & paket

export type Service = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  price: number;
  duration_minutes: number;
  commission_type: "percent" | "fixed";
  commission_value: number;
  warranty_days: number;
  is_taxable: boolean;
  is_active: boolean;
};

export async function listServices(): Promise<Service[]> {
  const s = await db();
  const rows: Service[] = must(
    await s
      .from("services")
      .select("id, code, name, category_id, price, duration_minutes, commission_type, commission_value, warranty_days, is_taxable, is_active")
      .order("code"),
    "jasa",
  );
  return rows.map((r) => ({ ...r, price: Number(r.price), commission_value: Number(r.commission_value) }));
}

export type PackageRow = { id: string; code: string; name: string; description: string | null; price: number; is_active: boolean; component_count: number };

export async function listPackages(): Promise<PackageRow[]> {
  const s = await db();
  type Row = Omit<PackageRow, "component_count"> & { package_items: { count: number }[] };
  const rows = must(await s.from("packages").select("id, code, name, description, price, is_active, package_items(count)").order("code"), "paket") as unknown as Row[];
  return rows.map(({ package_items, ...r }) => ({ ...r, price: Number(r.price), component_count: package_items[0]?.count ?? 0 }));
}

export type PackageComponent = {
  item_id: string | null;
  service_id: string | null;
  name: string;
  qty: number;
  normal_price: number;
  allocated_price: number;
};

export async function getPackage(id: string) {
  const s = await db();
  const pkg = must(await s.from("packages").select("id, code, name, description, price, is_active").eq("id", id).maybeSingle(), "paket") as
    | Omit<PackageRow, "component_count">
    | null;
  if (!pkg) return null;
  const components = must(await s.rpc("package_components", { p_package_id: id }), "komponen paket") as PackageComponent[];
  return {
    ...pkg,
    price: Number(pkg.price),
    components: components.map((c) => ({ ...c, qty: Number(c.qty), normal_price: Number(c.normal_price), allocated_price: Number(c.allocated_price) })),
  };
}

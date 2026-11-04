import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ApprovalChannel, EstimateStatus, WorkOrderStatus } from "@/lib/validation/service";

// Pembaca data servis (RLS: service_orders / service_board; mekanik hanya WO miliknya)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}
const num = (v: unknown) => Number(v ?? 0);

// ---------------------------------------------------------------------------- Work order

export type WorkOrderRow = {
  id: string;
  wo_no: string;
  estimate_id: string | null;
  vehicle_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  plate_no: string;
  vehicle_label: string | null;
  odometer_in: number | null;
  complaint: string | null;
  estimated_done_at: string | null;
  discount_amount: number;
  notes: string | null;
  is_warranty: boolean;
  warranty_source_id: string | null;
  status: WorkOrderStatus;
  status_changed_at: string;
  started_at: string | null;
  completed_at: string | null;
  delivered_at: string | null;
  void_reason: string | null;
  created_at: string;
  subtotal: number;
  total: number;
  duration_minutes: number;
  services: string;
  parts: string;
  parts_pending: number;
  parts_requested: number;
  warranty_until: string | null;
  /** Tanggal mulai garansi: tanggal invoice terbit (bila belum ada invoice: tanggal diserahkan) */
  warranty_start: string | null;
  mechanics: string;
  mechanic_ids: string[];
  minutes_in_status: number;
  is_overdue: boolean;
  pending_estimate_id: string | null;
};

const toWo = (r: WorkOrderRow): WorkOrderRow => ({ ...r, discount_amount: num(r.discount_amount), subtotal: num(r.subtotal), total: num(r.total) });

/** Papan: semua WO aktif + yang diambil/batal 14 hari terakhir */
export async function listWorkOrders(): Promise<WorkOrderRow[]> {
  const s = await createClient();
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const rows = must<WorkOrderRow[]>(
    await s
      .from("v_work_orders")
      .select("*")
      .or(`status.not.in.(delivered,void),status_changed_at.gte.${since}`)
      .order("created_at", { ascending: true })
      .limit(500),
    "work order",
  );
  return rows.map(toWo);
}

/** Riwayat servis satu kendaraan (PRD §6.3) */
export async function listVehicleWorkOrders(vehicleId: string): Promise<WorkOrderRow[]> {
  const s = await createClient();
  const rows = must<WorkOrderRow[]>(
    await s.from("v_work_orders").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }),
    "riwayat servis",
  );
  return rows.map(toWo);
}

export type WorkOrderLine = {
  id: string;
  line_type: "service" | "part";
  service_id: string | null;
  item_id: string | null;
  package_id: string | null;
  description: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  duration_minutes: number;
  warranty_days: number;
  sort_order: number;
  issued_qty: number;
  issue_requested_at: string | null;
  is_cancelled: boolean;
  cancel_reason: string | null;
  base_unit: string | null;
  item_sku: string | null;
  mechanics: { employee_id: string; share_percent: number }[];
};

export type PartIssue = { id: string; work_order_item_id: string; kind: "issue" | "return"; qty: number; location: string; note: string | null; scanned: boolean; created_at: string };
export type StatusLog = { id: string; from_status: WorkOrderStatus | null; to_status: WorkOrderStatus; employee_id: string | null; note: string | null; created_at: string };

export async function getWorkOrder(id: string) {
  const s = await createClient();
  const [wo, lines, issues, logs] = await Promise.all([
    s.from("v_work_orders").select("*").eq("id", id).maybeSingle(),
    s
      .from("work_order_items")
      .select(
        "id, line_type, service_id, item_id, package_id, description, qty, unit_price, discount_amount, line_total, duration_minutes, warranty_days, sort_order, issued_qty, issue_requested_at, is_cancelled, cancel_reason, items(sku, units!items_base_unit_id_fkey(code)), work_order_mechanics(employee_id, share_percent)",
      )
      .eq("work_order_id", id)
      .order("sort_order"),
    s.from("part_issues").select("id, work_order_item_id, kind, qty, note, scanned, created_at, locations(code, name)").eq("work_order_id", id).order("created_at", { ascending: false }),
    s.from("work_order_status_logs").select("id, from_status, to_status, employee_id, note, created_at").eq("work_order_id", id).order("created_at", { ascending: false }),
  ]);
  const row = must<WorkOrderRow | null>(wo, "work order");
  if (!row) return null;
  type LineRow = Omit<WorkOrderLine, "base_unit" | "item_sku" | "mechanics"> & {
    items: { sku: string; units: { code: string } } | null;
    work_order_mechanics: { employee_id: string; share_percent: number }[];
  };
  type IssueRow = Omit<PartIssue, "location"> & { locations: { code: string; name: string } };
  return {
    ...toWo(row),
    lines: must<LineRow[]>(lines, "baris WO").map(({ items, work_order_mechanics, ...l }) => ({
      ...l,
      qty: num(l.qty),
      unit_price: num(l.unit_price),
      discount_amount: num(l.discount_amount),
      line_total: num(l.line_total),
      issued_qty: num(l.issued_qty),
      base_unit: items?.units.code ?? null,
      item_sku: items?.sku ?? null,
      mechanics: work_order_mechanics.map((m) => ({ employee_id: m.employee_id, share_percent: num(m.share_percent) })),
    })),
    issues: must<IssueRow[]>(issues, "pengeluaran part").map(({ locations, ...i }) => ({ ...i, qty: num(i.qty), location: `${locations.code} · ${locations.name}` })),
    logs: must<StatusLog[]>(logs, "riwayat status"),
  };
}
export type WorkOrderDetail = NonNullable<Awaited<ReturnType<typeof getWorkOrder>>>;

export type WarrantyReport = {
  period: { from: string; to: string };
  claim_lines: number;
  claim_orders: number;
  part_cost: number;
  by_mechanic: { name: string; claims: number; part_cost: number }[];
  by_item: { code: string | null; name: string; kind: "part" | "jasa"; claims: number; part_cost: number }[];
  by_supplier: { name: string; claims: number; part_cost: number }[];
  claims: { wo_no: string; src_wo_no: string | null; plate_no: string; description: string; part_cost: number; created_at: string }[];
};

/** Laporan klaim garansi per mekanik, barang, dan supplier (izin laporan keuangan) */
export async function getWarrantyReport(from: string, to: string): Promise<WarrantyReport> {
  const s = await createClient();
  const r = must<WarrantyReport>(await s.rpc("report_warranty_claims", { p_from: from, p_to: to }), "laporan garansi");
  const n = (v: unknown) => Number(v ?? 0);
  return {
    ...r,
    part_cost: n(r.part_cost),
    by_mechanic: r.by_mechanic.map((x) => ({ ...x, part_cost: n(x.part_cost) })),
    by_item: r.by_item.map((x) => ({ ...x, part_cost: n(x.part_cost) })),
    by_supplier: r.by_supplier.map((x) => ({ ...x, part_cost: n(x.part_cost) })),
    claims: r.claims.map((x) => ({ ...x, part_cost: n(x.part_cost) })),
  };
}

export type Mechanic = { id: string; full_name: string };

export async function listMechanics(): Promise<Mechanic[]> {
  const s = await createClient();
  return must<Mechanic[]>(await s.rpc("list_mechanics"), "mekanik");
}

/** Nama karyawan untuk riwayat status (karyawan lain hanya terbaca lewat fungsi nama) */
export async function employeeNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const s = await createClient();
  const rows = must<{ id: string; full_name: string }[]>(await s.from("employees").select("id, full_name").in("id", unique), "karyawan");
  const mechanics = await listMechanics().catch(() => [] as Mechanic[]);
  return new Map([...mechanics, ...rows].map((r) => [r.id, r.full_name]));
}

/** Saldo stok per lokasi untuk barang di WO (pilihan rak saat mengeluarkan part) */
export async function stockByLocation(itemIds: string[]): Promise<{ item_id: string; location_id: string; location: string; location_code: string; qty: number }[]> {
  if (itemIds.length === 0) return [];
  const s = await createClient();
  type Row = { item_id: string; location_id: string; qty: number; locations: { code: string; name: string; is_active: boolean } };
  const rows = must<Row[]>(await s.from("stock_balances").select("item_id, location_id, qty, locations(code, name, is_active)").in("item_id", itemIds), "stok per lokasi");
  return rows
    .filter((r) => r.locations.is_active)
    .map((r) => ({ item_id: r.item_id, location_id: r.location_id, location: `${r.locations.code} · ${r.locations.name}`, location_code: r.locations.code, qty: num(r.qty) }));
}

// ---------------------------------------------------------------------------- Estimasi

export type EstimateRow = {
  id: string;
  estimate_no: string;
  version: number;
  previous_id: string | null;
  vehicle_id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  plate_no: string;
  odometer: number | null;
  complaint: string | null;
  valid_until: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  notes: string | null;
  is_additional: boolean;
  work_order_id: string | null;
  wo_no: string | null;
  status: EstimateStatus;
  sent_at: string | null;
  approval_channel: ApprovalChannel | null;
  approval_note: string | null;
  decided_at: string | null;
  void_reason: string | null;
  created_at: string;
  is_latest: boolean;
  line_count: number;
};

const toEstimate = (r: EstimateRow): EstimateRow => ({ ...r, subtotal: num(r.subtotal), discount_amount: num(r.discount_amount), total: num(r.total) });

export async function listEstimates(): Promise<EstimateRow[]> {
  const s = await createClient();
  const rows = must<EstimateRow[]>(
    await s.from("v_estimates").select("*").eq("is_latest", true).eq("is_additional", false).order("created_at", { ascending: false }).limit(300),
    "estimasi",
  );
  return rows.map(toEstimate);
}

export type EstimateLine = {
  id: string;
  line_type: "service" | "part";
  service_id: string | null;
  item_id: string | null;
  package_id: string | null;
  description: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
};

export async function getEstimate(id: string) {
  const s = await createClient();
  const [est, lines] = await Promise.all([
    s.from("v_estimates").select("*").eq("id", id).maybeSingle(),
    s
      .from("estimate_items")
      .select("id, line_type, service_id, item_id, package_id, description, qty, unit_price, discount_amount, line_total")
      .eq("estimate_id", id)
      .order("sort_order"),
  ]);
  const row = must<EstimateRow | null>(est, "estimasi");
  if (!row) return null;
  const versions = must<{ id: string; version: number; status: EstimateStatus; total: number; created_at: string }[]>(
    await s.from("estimates").select("id, version, status, total, created_at").eq("estimate_no", row.estimate_no).order("version", { ascending: false }),
    "versi estimasi",
  );
  return {
    ...toEstimate(row),
    lines: must<EstimateLine[]>(lines, "baris estimasi").map((l) => ({
      ...l,
      qty: num(l.qty),
      unit_price: num(l.unit_price),
      discount_amount: num(l.discount_amount),
      line_total: num(l.line_total),
    })),
    versions: versions.map((v) => ({ ...v, total: num(v.total) })),
  };
}
export type EstimateDetail = NonNullable<Awaited<ReturnType<typeof getEstimate>>>;

/** Estimasi tambahan sebuah WO (riwayat persetujuan pekerjaan tambahan) */
export async function listAdditionalEstimates(workOrderId: string) {
  const s = await createClient();
  const rows = must<EstimateRow[]>(
    await s.from("v_estimates").select("*").eq("work_order_id", workOrderId).eq("is_additional", true).order("created_at", { ascending: false }),
    "estimasi tambahan",
  );
  const lines = rows.length
    ? must<(EstimateLine & { estimate_id: string })[]>(
        await s
          .from("estimate_items")
          .select("id, estimate_id, line_type, description, qty, line_total")
          .in(
            "estimate_id",
            rows.map((r) => r.id),
          )
          .order("sort_order"),
        "baris estimasi tambahan",
      )
    : [];
  return rows.map((r) => ({ ...toEstimate(r), lines: lines.filter((l) => l.estimate_id === r.id).map((l) => ({ ...l, qty: num(l.qty), line_total: num(l.line_total) })) }));
}

// ---------------------------------------------------------------------------- Pilihan form

export type CatalogOption = { key: string; type: "service" | "part" | "package"; id: string; code: string; name: string; price: number; stock?: number; unit?: string; detail?: string };

/** Jasa, paket, dan part aktif untuk baris estimasi */
export async function listCatalog(): Promise<CatalogOption[]> {
  const s = await createClient();
  const [services, packages, items, stock] = await Promise.all([
    s.from("services").select("id, code, name, price, duration_minutes").eq("is_active", true).order("name"),
    s.from("packages").select("id, code, name, price, package_items(count)").eq("is_active", true).order("name"),
    s.from("items").select("id, sku, name, sell_price, units!items_base_unit_id_fkey(code)").eq("is_active", true).order("name"),
    s.from("v_stock_on_hand").select("item_id, qty"),
  ]);
  const qty = new Map(must<{ item_id: string; qty: number }[]>(stock, "stok").map((r) => [r.item_id, num(r.qty)]));
  return [
    ...must<{ id: string; code: string; name: string; price: number; duration_minutes: number }[]>(services, "jasa").map(
      (r): CatalogOption => ({ key: `service:${r.id}`, type: "service", id: r.id, code: r.code, name: r.name, price: num(r.price), detail: `${r.duration_minutes} menit` }),
    ),
    ...must<{ id: string; code: string; name: string; price: number; package_items: { count: number }[] }[]>(packages, "paket").map(
      (r): CatalogOption => ({ key: `package:${r.id}`, type: "package", id: r.id, code: r.code, name: r.name, price: num(r.price), detail: `${r.package_items[0]?.count ?? 0} komponen` }),
    ),
    ...must<{ id: string; sku: string; name: string; sell_price: number; units: { code: string } }[]>(items, "barang").map(
      (r): CatalogOption => ({ key: `part:${r.id}`, type: "part", id: r.id, code: r.sku, name: r.name, price: num(r.sell_price), stock: qty.get(r.id) ?? 0, unit: r.units.code }),
    ),
  ];
}

export type VehicleOption = {
  id: string;
  plate_no: string;
  label: string;
  customer_name: string | null;
  last_odometer: number | null;
  last_service: { wo_no: string; date: string; services: string; parts: string } | null;
};

/** Kendaraan aktif + servis terakhir (PRD §6.3: tampil saat membuat estimasi) */
export async function listVehicleOptions(): Promise<VehicleOption[]> {
  const s = await createClient();
  type V = { id: string; plate_no: string; make_name: string | null; model_name: string | null; year: number | null; customer_name: string | null; last_odometer: number | null };
  const [vehicles, last] = await Promise.all([
    s.from("v_vehicles").select("id, plate_no, make_name, model_name, year, customer_name, last_odometer").eq("is_active", true).order("plate_key"),
    s.from("v_work_orders").select("vehicle_id, wo_no, delivered_at, services, parts").eq("status", "delivered").order("delivered_at", { ascending: false }).limit(1000),
  ]);
  const latest = new Map<string, VehicleOption["last_service"]>();
  for (const w of must<{ vehicle_id: string; wo_no: string; delivered_at: string; services: string; parts: string }[]>(last, "servis terakhir")) {
    if (!latest.has(w.vehicle_id)) latest.set(w.vehicle_id, { wo_no: w.wo_no, date: w.delivered_at, services: w.services, parts: w.parts });
  }
  return must<V[]>(vehicles, "kendaraan").map((v) => ({
    id: v.id,
    plate_no: v.plate_no,
    label: [v.make_name, v.model_name, v.year].filter(Boolean).join(" "),
    customer_name: v.customer_name,
    last_odometer: v.last_odometer,
    last_service: latest.get(v.id) ?? null,
  }));
}

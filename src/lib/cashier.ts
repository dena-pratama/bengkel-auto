import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PayMethod } from "@/lib/validation/cashier";

// Pembaca data kasir (RLS: sales / receivables / cash_shift)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}
const num = (v: unknown) => Number(v ?? 0);

export type SaleStatus = "draft" | "posted" | "void";

export type SaleRow = {
  id: string;
  sale_no: string | null;
  source: "pos" | "work_order";
  work_order_id: string | null;
  wo_no: string | null;
  plate_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  sale_date: string;
  due_date: string | null;
  status: SaleStatus;
  subtotal: number;
  discount_amount: number;
  ppn_amount: number;
  ppn_included: boolean;
  total: number;
  notes: string | null;
  void_reason: string | null;
  posted_at: string | null;
  created_at: string;
  paid: number;
  returned_total: number;
  outstanding: number;
  days_overdue: number | null;
  age_bucket: string | null;
  line_count: number;
};

const toSale = (r: SaleRow): SaleRow => ({
  ...r,
  subtotal: num(r.subtotal),
  discount_amount: num(r.discount_amount),
  ppn_amount: num(r.ppn_amount),
  total: num(r.total),
  paid: num(r.paid),
  returned_total: num(r.returned_total),
  outstanding: num(r.outstanding),
});

export async function listSales(): Promise<SaleRow[]> {
  const s = await createClient();
  return must<SaleRow[]>(await s.from("v_sales").select("*").order("created_at", { ascending: false }).limit(300), "penjualan").map(toSale);
}

export async function listOutstandingSales(): Promise<SaleRow[]> {
  const s = await createClient();
  return must<SaleRow[]>(await s.from("v_sales").select("*").eq("status", "posted").gt("outstanding", 0).order("sale_date"), "piutang").map(toSale);
}

export type SaleLine = {
  id: string;
  line_type: "service" | "part";
  description: string;
  qty: number;
  returned_qty: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  item_id: string | null;
  location_id: string | null;
};

export type PaymentRow = {
  id: string;
  kind: "sale" | "deposit";
  method: PayMethod | "deposit";
  amount: number;
  reference: string | null;
  status: "posted" | "void";
  void_reason: string | null;
  shift_id: string | null;
  created_at: string;
  account: string | null;
};

export async function getSale(id: string) {
  const s = await createClient();
  const [sale, items, payments, returns] = await Promise.all([
    s.from("v_sales").select("*").eq("id", id).maybeSingle(),
    s.from("sale_items").select("id, line_type, description, qty, returned_qty, unit_price, discount_amount, line_total, item_id, location_id").eq("sale_id", id).order("sort_order"),
    s
      .from("payments")
      .select("id, kind, method, amount, reference, status, void_reason, shift_id, created_at, cash_bank_accounts(name)")
      .eq("sale_id", id)
      .order("created_at"),
    s.from("v_sale_returns").select("*").eq("sale_id", id).order("created_at", { ascending: false }),
  ]);
  const row = must<SaleRow | null>(sale, "penjualan");
  if (!row) return null;
  type PayRow = Omit<PaymentRow, "account"> & { cash_bank_accounts: { name: string } | null };
  return {
    ...toSale(row),
    lines: must<SaleLine[]>(items, "baris penjualan").map((l) => ({
      ...l,
      qty: num(l.qty),
      returned_qty: num(l.returned_qty),
      unit_price: num(l.unit_price),
      discount_amount: num(l.discount_amount),
      line_total: num(l.line_total),
    })),
    payments: must<PayRow[]>(payments, "pembayaran").map(({ cash_bank_accounts, ...p }) => ({ ...p, amount: num(p.amount), account: cash_bank_accounts?.name ?? null })),
    returns: must<SaleReturnRow[]>(returns, "retur penjualan").map(toSaleReturn),
  };
}
export type SaleDetail = NonNullable<Awaited<ReturnType<typeof getSale>>>;

export type ShiftRow = {
  id: string;
  shift_no: string;
  cashier_id: string;
  cashier_name: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  status: "open" | "closed" | "approved";
  expected_cash: number | null;
  counted_cash: number | null;
  variance: number | null;
  close_note: string | null;
  approval_note: string | null;
  approved_at: string | null;
  cash_in: number;
  cash_out: number;
  transfer_in: number;
  qris_in: number;
  card_in: number;
  expected_now: number | null;
};

const toShift = (r: ShiftRow): ShiftRow => ({
  ...r,
  opening_cash: num(r.opening_cash),
  expected_cash: r.expected_cash == null ? null : num(r.expected_cash),
  counted_cash: r.counted_cash == null ? null : num(r.counted_cash),
  variance: r.variance == null ? null : num(r.variance),
  cash_in: num(r.cash_in),
  cash_out: num(r.cash_out),
  transfer_in: num(r.transfer_in),
  qris_in: num(r.qris_in),
  card_in: num(r.card_in),
  expected_now: r.expected_now == null ? null : num(r.expected_now),
});

export async function getMyOpenShift(employeeId: string): Promise<ShiftRow | null> {
  const s = await createClient();
  const r = must<ShiftRow | null>(await s.from("v_cash_shifts").select("*").eq("cashier_id", employeeId).eq("status", "open").maybeSingle(), "shift");
  return r ? toShift(r) : null;
}

export async function listShifts(): Promise<ShiftRow[]> {
  const s = await createClient();
  return must<ShiftRow[]>(await s.from("v_cash_shifts").select("*").order("opened_at", { ascending: false }).limit(60), "shift").map(toShift);
}

export async function getShift(id: string) {
  const s = await createClient();
  const [shift, pays, outs] = await Promise.all([
    s.from("v_cash_shifts").select("*").eq("id", id).maybeSingle(),
    s
      .from("payments")
      .select("id, kind, method, amount, reference, status, created_at, sale_id, work_order_id, sales:sale_id(sale_no), cash_bank_accounts(name)")
      .eq("shift_id", id)
      .order("created_at"),
    s.from("cash_movements").select("id, amount, note, created_at, accounts(name)").eq("shift_id", id).order("created_at"),
  ]);
  const row = must<ShiftRow | null>(shift, "shift");
  if (!row) return null;
  type PayRow = { id: string; kind: "sale" | "deposit"; method: PayMethod; amount: number; reference: string | null; status: "posted" | "void"; created_at: string; sale_id: string | null; sales: { sale_no: string | null } | null; cash_bank_accounts: { name: string } | null };
  type OutRow = { id: string; amount: number; note: string; created_at: string; accounts: { name: string } };
  return {
    ...toShift(row),
    payments: must<PayRow[]>(pays, "pembayaran shift").map((p) => ({ ...p, amount: num(p.amount) })),
    cashOuts: must<OutRow[]>(outs, "kas keluar").map((o) => ({ ...o, amount: num(o.amount) })),
  };
}
export type ShiftDetail = NonNullable<Awaited<ReturnType<typeof getShift>>>;

export type ArCustomer = {
  customer_id: string;
  customer_name: string;
  invoices: number;
  outstanding: number;
  bucket_0_30: number | null;
  bucket_31_60: number | null;
  bucket_60_plus: number | null;
  max_days_overdue: number | null;
};

export async function listArCustomers(): Promise<ArCustomer[]> {
  const s = await createClient();
  return must<ArCustomer[]>(await s.from("v_ar_customers").select("*").order("outstanding", { ascending: false }), "piutang").map((r) => ({
    ...r,
    outstanding: num(r.outstanding),
    bucket_0_30: num(r.bucket_0_30),
    bucket_31_60: num(r.bucket_31_60),
    bucket_60_plus: num(r.bucket_60_plus),
  }));
}

export type BillableWorkOrder = {
  id: string;
  wo_no: string;
  plate_no: string;
  vehicle_label: string | null;
  customer_name: string | null;
  total: number;
  services: string;
  deposit: number;
  invoice_id: string | null;
  invoice_no: string | null;
  outstanding: number;
  status: string;
};

/** WO Siap Diambil yang belum diinvoice, plus WO yang sudah diinvoice tetapi belum lunas/diserahkan */
export async function listBillableWorkOrders(): Promise<BillableWorkOrder[]> {
  const s = await createClient();
  const wos = must<{ id: string; wo_no: string; plate_no: string; vehicle_label: string | null; customer_name: string | null; total: number; services: string; status: string }[]>(
    await s.from("v_work_orders").select("id, wo_no, plate_no, vehicle_label, customer_name, total, services, status").eq("is_warranty", false).in("status", ["ready", "quality_check", "in_progress", "waiting_parts", "queued", "waiting_approval"]).order("created_at"),
    "work order",
  );
  const ids = wos.map((w) => w.id);
  if (ids.length === 0) return [];
  const [invoices, deposits] = await Promise.all([
    s.from("v_sales").select("id, sale_no, work_order_id, outstanding").eq("status", "posted").in("work_order_id", ids),
    s.from("payments").select("work_order_id, amount").eq("kind", "deposit").eq("status", "posted").is("applied_sale_id", null).in("work_order_id", ids),
  ]);
  const inv = new Map(must<{ id: string; sale_no: string; work_order_id: string; outstanding: number }[]>(invoices, "invoice WO").map((i) => [i.work_order_id, i]));
  const dep = new Map<string, number>();
  for (const d of must<{ work_order_id: string; amount: number }[]>(deposits, "DP")) dep.set(d.work_order_id, (dep.get(d.work_order_id) ?? 0) + num(d.amount));
  return wos.map((w) => ({
    ...w,
    total: num(w.total),
    deposit: dep.get(w.id) ?? 0,
    invoice_id: inv.get(w.id)?.id ?? null,
    invoice_no: inv.get(w.id)?.sale_no ?? null,
    outstanding: num(inv.get(w.id)?.outstanding),
  }));
}

/** Tagihan & DP satu WO (untuk kartu penagihan di detail WO) */
export async function getWorkOrderBilling(woId: string) {
  const s = await createClient();
  const [inv, dep] = await Promise.all([
    s.from("v_sales").select("id, sale_no, total, paid, outstanding, status").eq("work_order_id", woId).eq("status", "posted").maybeSingle(),
    s.from("payments").select("amount").eq("kind", "deposit").eq("status", "posted").is("applied_sale_id", null).eq("work_order_id", woId),
  ]);
  const invoice = must<{ id: string; sale_no: string; total: number; paid: number; outstanding: number } | null>(inv, "invoice WO");
  return {
    invoice: invoice ? { ...invoice, total: num(invoice.total), paid: num(invoice.paid), outstanding: num(invoice.outstanding) } : null,
    deposit: must<{ amount: number }[]>(dep, "DP").reduce((t, d) => t + num(d.amount), 0),
  };
}

export type ExpenseAccount = { id: string; code: string; name: string };

export async function listExpenseAccounts(): Promise<ExpenseAccount[]> {
  const s = await createClient();
  return must<ExpenseAccount[]>(await s.from("accounts").select("id, code, name").in("type", ["expense", "other"]).eq("is_active", true).order("code"), "akun beban");
}

/** Pengaturan tampilan kasir: PPN aktif & harga termasuk PPN */
export async function cashierSettings() {
  const s = await createClient();
  const rows = must<{ key: string; value: unknown }[]>(
    await s.from("settings").select("key, value").in("key", ["ppn_enabled", "prices_include_ppn", "discount_limit_cashier", "discount_limit_admin"]),
    "setting",
  );
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return { ppnEnabled: m.get("ppn_enabled") === true, pricesIncludePpn: m.get("prices_include_ppn") === true };
}

export type SaleReturnRow = {
  id: string;
  branch_id: string;
  return_no: string;
  sale_id: string;
  sale_no: string | null;
  sale_source: "pos" | "work_order";
  wo_no: string | null;
  plate_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  return_date: string;
  settlement: "debt" | "refund";
  payment_method: PayMethod | null;
  cash_bank_account_id: string | null;
  cash_bank_account_name: string | null;
  shift_id: string | null;
  shift_no: string | null;
  amount: number;
  ppn_amount: number;
  total: number;
  reason: string;
  status: "posted" | "void";
  void_reason: string | null;
  created_at: string;
  created_by_name: string | null;
  item_count: number;
};

export const toSaleReturn = (r: SaleReturnRow): SaleReturnRow => ({
  ...r,
  amount: num(r.amount),
  ppn_amount: num(r.ppn_amount),
  total: num(r.total),
  item_count: num(r.item_count),
});

export async function listSaleReturns(): Promise<SaleReturnRow[]> {
  const s = await createClient();
  return must<SaleReturnRow[]>(
    await s.from("v_sale_returns").select("*").order("created_at", { ascending: false }).limit(200),
    "retur penjualan",
  ).map(toSaleReturn);
}

export type SaleReturnItemDetail = {
  id: string;
  sale_item_id: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  base_unit: string;
  condition: "good" | "damaged";
  location_id: string;
  location_code: string;
  location_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export async function getSaleReturn(id: string) {
  const s = await createClient();
  const [ret, items] = await Promise.all([
    s.from("v_sale_returns").select("*").eq("id", id).maybeSingle(),
    s
      .from("sale_return_items")
      .select("id, sale_item_id, item_id, condition, location_id, qty, unit_price, line_total, items(sku, name, units:base_unit_id(code)), locations(code, name)")
      .eq("return_id", id),
  ]);
  const row = must<SaleReturnRow | null>(ret, "retur penjualan");
  if (!row) return null;
  type ItemRes = {
    id: string;
    sale_item_id: string;
    item_id: string;
    condition: "good" | "damaged";
    location_id: string;
    qty: number;
    unit_price: number;
    line_total: number;
    items: { sku: string; name: string; units: { code: string } | null } | null;
    locations: { code: string; name: string } | null;
  };
  return {
    ...toSaleReturn(row),
    items: must<ItemRes[]>(items, "baris retur").map((i) => ({
      id: i.id,
      sale_item_id: i.sale_item_id,
      item_id: i.item_id,
      item_name: i.items?.name ?? "Barang",
      item_sku: i.items?.sku ?? "-",
      base_unit: i.items?.units?.code ?? "pcs",
      condition: i.condition,
      location_id: i.location_id,
      location_code: i.locations?.code ?? "-",
      location_name: i.locations?.name ?? "-",
      qty: num(i.qty),
      unit_price: num(i.unit_price),
      line_total: num(i.line_total),
    })),
  };
}
export type SaleReturnDetail = NonNullable<Awaited<ReturnType<typeof getSaleReturn>>>;

export type ReturnLocation = { id: string; code: string; name: string; type: string };

export async function listReturnLocations(): Promise<ReturnLocation[]> {
  const s = await createClient();
  return must<ReturnLocation[]>(
    await s.from("locations").select("id, code, name, type").in("type", ["rack", "bin"]).eq("is_active", true).order("code"),
    "lokasi rak",
  );
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca data pembelian & hutang (RLS: purchasing / payables)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}
const num = (v: unknown) => Number(v ?? 0);

export type Supplier = {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  npwp: string | null;
  payment_terms_days: number;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  notes: string | null;
  is_active: boolean;
};

const SUPPLIER_COLUMNS =
  "id, code, name, contact_name, phone, email, address, npwp, payment_terms_days, bank_name, bank_account_number, bank_account_name, notes, is_active";

export async function listSuppliers(): Promise<Supplier[]> {
  const s = await createClient();
  return must(await s.from("suppliers").select(SUPPLIER_COLUMNS).order("name"), "supplier");
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const s = await createClient();
  return must(await s.from("suppliers").select(SUPPLIER_COLUMNS).eq("id", id).maybeSingle(), "supplier");
}

export type CashBankAccount = { id: string; name: string; kind: "cash" | "bank"; is_active: boolean };

export async function listCashBankAccounts(): Promise<CashBankAccount[]> {
  const s = await createClient();
  return must(await s.from("cash_bank_accounts").select("id, name, kind, is_active").order("kind").order("name"), "kas/bank");
}

/** PPN aktif (PKP)? Menentukan PPN faktur supplier masuk HPP atau PPN Masukan. */
export async function ppnEnabled(): Promise<boolean> {
  const s = await createClient();
  const { data } = await s.from("settings").select("value").eq("key", "ppn_enabled").maybeSingle();
  return data?.value === true;
}

// ---------------------------------------------------------------------------- Pilihan barang untuk form

export type ItemOption = {
  id: string;
  sku: string;
  name: string;
  base_unit_id: string;
  base_unit: string;
  default_location_id: string | null;
  units: { unit_id: string; code: string; factor: number; is_purchase: boolean }[];
  qty: number;
  min_stock: number;
};

export async function listItemOptions(): Promise<ItemOption[]> {
  const s = await createClient();
  const [items, stock] = await Promise.all([
    s
      .from("items")
      .select("id, sku, name, base_unit_id, default_location_id, min_stock, units!items_base_unit_id_fkey(code), item_units(unit_id, factor, is_purchase, units(code))")
      .eq("is_active", true)
      .order("name"),
    s.from("v_stock_on_hand").select("item_id, qty"),
  ]);
  type Row = {
    id: string;
    sku: string;
    name: string;
    base_unit_id: string;
    default_location_id: string | null;
    min_stock: number;
    units: { code: string };
    item_units: { unit_id: string; factor: number; is_purchase: boolean; units: { code: string } }[];
  };
  const qty = new Map(must<{ item_id: string; qty: number }[]>(stock, "stok").map((r) => [r.item_id, num(r.qty)]));
  return must<Row[]>(items, "barang").map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    base_unit_id: r.base_unit_id,
    base_unit: r.units.code,
    default_location_id: r.default_location_id,
    min_stock: num(r.min_stock),
    qty: qty.get(r.id) ?? 0,
    units: [
      { unit_id: r.base_unit_id, code: r.units.code, factor: 1, is_purchase: true },
      ...r.item_units.map((u) => ({ unit_id: u.unit_id, code: u.units.code, factor: num(u.factor), is_purchase: u.is_purchase })),
    ],
  }));
}

// ---------------------------------------------------------------------------- PO

export type PoStatus = "draft" | "sent" | "partial" | "received" | "closed" | "cancelled";

export type PoListRow = {
  id: string;
  po_no: string;
  supplier_id: string;
  supplier: string;
  order_date: string;
  expected_date: string | null;
  status: PoStatus;
  total: number;
  lines: number;
};

export async function listPurchaseOrders(): Promise<PoListRow[]> {
  const s = await createClient();
  type Row = Omit<PoListRow, "supplier" | "total" | "lines"> & {
    suppliers: { name: string };
    purchase_order_items: { qty: number; unit_price: number }[];
  };
  const rows = must<Row[]>(
    await s
      .from("purchase_orders")
      .select("id, po_no, supplier_id, order_date, expected_date, status, suppliers(name), purchase_order_items(qty, unit_price)")
      .order("created_at", { ascending: false })
      .limit(300),
    "PO",
  );
  return rows.map(({ suppliers, purchase_order_items, ...r }) => ({
    ...r,
    supplier: suppliers.name,
    lines: purchase_order_items.length,
    total: purchase_order_items.reduce((t, i) => t + num(i.qty) * num(i.unit_price), 0),
  }));
}

export type PoItem = {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  unit_id: string;
  unit: string;
  base_unit: string;
  factor: number;
  qty: number;
  unit_price: number;
  received_base_qty: number;
};

export async function getPurchaseOrder(id: string) {
  const s = await createClient();
  type Row = {
    id: string;
    po_no: string;
    supplier_id: string;
    order_date: string;
    expected_date: string | null;
    status: PoStatus;
    notes: string | null;
    cancel_reason: string | null;
    suppliers: { name: string };
    purchase_order_items: {
      id: string;
      item_id: string;
      unit_id: string;
      factor: number;
      qty: number;
      unit_price: number;
      received_base_qty: number;
      items: { name: string; sku: string; units: { code: string } };
      units: { code: string };
    }[];
  };
  const row = must<Row | null>(
    await s
      .from("purchase_orders")
      .select(
        "id, po_no, supplier_id, order_date, expected_date, status, notes, cancel_reason, suppliers(name), purchase_order_items(id, item_id, unit_id, factor, qty, unit_price, received_base_qty, items(name, sku, units!items_base_unit_id_fkey(code)), units(code))",
      )
      .eq("id", id)
      .maybeSingle(),
    "PO",
  );
  if (!row) return null;
  const { suppliers, purchase_order_items, ...po } = row;
  return {
    ...po,
    supplier: suppliers.name,
    items: purchase_order_items.map(
      (i): PoItem => ({
        id: i.id,
        item_id: i.item_id,
        item_name: i.items.name,
        sku: i.items.sku,
        unit_id: i.unit_id,
        unit: i.units.code,
        base_unit: i.items.units.code,
        factor: num(i.factor),
        qty: num(i.qty),
        unit_price: num(i.unit_price),
        received_base_qty: num(i.received_base_qty),
      }),
    ),
  };
}

// ---------------------------------------------------------------------------- Penerimaan & hutang

export type ApRow = {
  receipt_id: string;
  gr_no: string;
  supplier_id: string;
  supplier_name: string;
  invoice_no: string | null;
  receipt_date: string;
  due_date: string;
  total: number;
  paid: number;
  returned: number;
  outstanding: number;
  days_overdue: number;
  age_bucket: string;
};

export async function listApReceipts(onlyOpen = true): Promise<ApRow[]> {
  const s = await createClient();
  let q = s.from("v_ap_receipts").select("*").order("due_date");
  if (onlyOpen) q = q.gt("outstanding", 0);
  return must<ApRow[]>(await q, "hutang").map((r) => ({
    ...r,
    total: num(r.total),
    paid: num(r.paid),
    returned: num(r.returned),
    outstanding: num(r.outstanding),
  }));
}

export type ReceiptListRow = {
  id: string;
  gr_no: string;
  supplier_id: string;
  supplier: string;
  receipt_date: string;
  invoice_no: string | null;
  total: number;
  po_no: string | null;
};

export async function listReceipts(): Promise<ReceiptListRow[]> {
  const s = await createClient();
  type Row = Omit<ReceiptListRow, "supplier" | "po_no"> & { suppliers: { name: string }; purchase_orders: { po_no: string } | null };
  const rows = must<Row[]>(
    await s
      .from("goods_receipts")
      .select("id, gr_no, supplier_id, receipt_date, invoice_no, total, suppliers(name), purchase_orders(po_no)")
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .limit(300),
    "penerimaan",
  );
  return rows.map(({ suppliers, purchase_orders, ...r }) => ({ ...r, total: num(r.total), supplier: suppliers.name, po_no: purchase_orders?.po_no ?? null }));
}

export type ReceiptItem = {
  id: string;
  item_name: string;
  sku: string;
  unit: string;
  base_unit: string;
  qty: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  base_qty: number;
  returned_base_qty: number;
  location: string;
};

export async function getReceipt(id: string) {
  const s = await createClient();
  type Row = {
    id: string;
    gr_no: string;
    supplier_id: string;
    receipt_date: string;
    invoice_no: string | null;
    invoice_date: string | null;
    due_date: string;
    subtotal: number;
    ppn_amount: number;
    ppn_capitalized: boolean;
    total: number;
    notes: string | null;
    suppliers: { name: string };
    purchase_orders: { id: string; po_no: string } | null;
    goods_receipt_items: {
      id: string;
      qty: number;
      unit_price: number;
      discount_amount: number;
      line_total: number;
      base_qty: number;
      returned_base_qty: number;
      items: { name: string; sku: string; units: { code: string } };
      units: { code: string };
      locations: { code: string; name: string };
    }[];
    purchase_returns: { id: string; return_no: string; return_date: string; settlement: "debt" | "refund"; amount: number; ppn_amount: number; reason: string }[];
  };
  const row = must<Row | null>(
    await s
      .from("goods_receipts")
      .select(
        "id, gr_no, supplier_id, receipt_date, invoice_no, invoice_date, due_date, subtotal, ppn_amount, ppn_capitalized, total, notes, suppliers(name), purchase_orders(id, po_no), goods_receipt_items(id, qty, unit_price, discount_amount, line_total, base_qty, returned_base_qty, items(name, sku, units!items_base_unit_id_fkey(code)), units(code), locations(code, name)), purchase_returns(id, return_no, return_date, settlement, amount, ppn_amount, reason)",
      )
      .eq("id", id)
      .maybeSingle(),
    "penerimaan",
  );
  if (!row) return null;
  const { suppliers, purchase_orders, goods_receipt_items, purchase_returns, ...gr } = row;
  return {
    ...gr,
    subtotal: num(gr.subtotal),
    ppn_amount: num(gr.ppn_amount),
    total: num(gr.total),
    supplier: suppliers.name,
    po: purchase_orders,
    items: goods_receipt_items.map(
      (i): ReceiptItem => ({
        id: i.id,
        item_name: i.items.name,
        sku: i.items.sku,
        unit: i.units.code,
        base_unit: i.items.units.code,
        qty: num(i.qty),
        unit_price: num(i.unit_price),
        discount_amount: num(i.discount_amount),
        line_total: num(i.line_total),
        base_qty: num(i.base_qty),
        returned_base_qty: num(i.returned_base_qty),
        location: `${i.locations.code} · ${i.locations.name}`,
      }),
    ),
    returns: purchase_returns.map((r) => ({ ...r, amount: num(r.amount), ppn_amount: num(r.ppn_amount) })),
  };
}

export type PaymentRow = {
  id: string;
  payment_no: string;
  supplier: string;
  payment_date: string;
  amount: number;
  status: "posted" | "void";
  void_reason: string | null;
  account: string;
  receipts: string[];
};

export async function listSupplierPayments(): Promise<PaymentRow[]> {
  const s = await createClient();
  type Row = Omit<PaymentRow, "supplier" | "account" | "receipts"> & {
    suppliers: { name: string };
    cash_bank_accounts: { name: string };
    supplier_payment_allocations: { goods_receipts: { gr_no: string } }[];
  };
  const rows = must<Row[]>(
    await s
      .from("supplier_payments")
      .select("id, payment_no, payment_date, amount, status, void_reason, suppliers(name), cash_bank_accounts(name), supplier_payment_allocations(goods_receipts(gr_no))")
      .order("created_at", { ascending: false })
      .limit(100),
    "pembayaran",
  );
  return rows.map(({ suppliers, cash_bank_accounts, supplier_payment_allocations, ...r }) => ({
    ...r,
    amount: num(r.amount),
    supplier: suppliers.name,
    account: cash_bank_accounts.name,
    receipts: supplier_payment_allocations.map((a) => a.goods_receipts.gr_no),
  }));
}

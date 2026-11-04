// Label Indonesia untuk audit log. Nama tabel mengikuti skema (Inggris), tampilan Indonesia.

export const ACTION_LABEL: Record<string, string> = {
  insert: "Dibuat",
  update: "Diubah",
  delete: "Dihapus",
  void: "Dibatalkan",
  approve: "Disetujui",
  ai_tool_call: "Panggilan AI",
  login: "Masuk",
  other: "Lainnya",
};

export const TABLE_LABEL: Record<string, string> = {
  accounts: "Akun (COA)",
  ai_tool_calls: "Panggilan AI",
  branches: "Cabang",
  brands: "Merek",
  cash_bank_accounts: "Kas dan bank",
  cash_movements: "Mutasi kas",
  cash_shifts: "Shift kas",
  cash_transactions: "Kas masuk dan keluar",
  commissions: "Komisi",
  customers: "Pelanggan",
  employee_loan_payments: "Cicilan kasbon",
  employee_loans: "Kasbon",
  employee_pay_profiles: "Profil gaji",
  employee_roles: "Role karyawan",
  employees: "Karyawan",
  estimates: "Estimasi",
  fiscal_periods: "Periode buku",
  goods_receipts: "Penerimaan barang",
  item_categories: "Kategori barang",
  item_costs: "HPP barang",
  items: "Barang",
  journal_entries: "Jurnal",
  locations: "Lokasi rak",
  packages: "Paket",
  part_issues: "Pengambilan part",
  payments: "Pembayaran",
  payroll_periods: "Periode gaji",
  payslips: "Slip gaji",
  profiles: "Akun login",
  purchase_orders: "Purchase order",
  purchase_returns: "Retur pembelian",
  recurring_expenses: "Biaya rutin",
  role_permissions: "Izin role",
  roles: "Role",
  sale_items: "Baris invoice",
  sale_returns: "Retur penjualan",
  sales: "Invoice",
  service_categories: "Kategori jasa",
  services: "Jasa",
  settings: "Pengaturan",
  stock_movements: "Mutasi stok",
  stock_opnames: "Stok opname",
  supplier_payments: "Pembayaran supplier",
  suppliers: "Supplier",
  tax_payments: "Setoran pajak",
  tax_period_summaries: "Pajak per periode",
  tax_rates: "Tarif pajak",
  tax_settings: "Pengaturan pajak",
  units: "Satuan",
  vehicle_ownerships: "Kepemilikan kendaraan",
  vehicles: "Kendaraan",
  work_order_items: "Baris work order",
  work_orders: "Work order",
};

export const tableLabel = (t: string) => TABLE_LABEL[t] ?? t.replaceAll("_", " ");

// Kolom teknis yang tidak berguna saat membandingkan sebelum dan sesudah
const SKIP = new Set(["updated_at", "created_at", "created_by", "branch_id"]);

export type FieldChange = { field: string; before: unknown; after: unknown };

/** Daftar kolom yang berubah (update) atau seluruh nilai (insert/delete). */
export function diffFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): FieldChange[] {
  const keys = [...new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})])].filter((k) => !SKIP.has(k) && k !== "id");
  const out: FieldChange[] = [];
  for (const k of keys) {
    const a = oldData?.[k];
    const b = newData?.[k];
    if (oldData && newData && JSON.stringify(a) === JSON.stringify(b)) continue;
    out.push({ field: k, before: a, after: b });
  }
  return out;
}

export const showValue = (v: unknown) => {
  if (v === null || v === undefined) return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

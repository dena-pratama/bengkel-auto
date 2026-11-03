import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca data pajak (RLS & fungsi laporan memeriksa izin tax_settings / finance_reports)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}
const num = (v: unknown) => Number(v ?? 0);

export type BusinessForm = "orang_pribadi" | "pt_perorangan" | "koperasi" | "cv_firma_pt";
export type PphMode = "off" | "final" | "general";

export type TaxSettings = {
  business_form: BusinessForm;
  is_pkp: boolean;
  pph_mode: PphMode;
  pph_final_rate: number;
  general_rate: number;
  annual_ceiling: number;
  free_threshold: number;
  facility_end_date: string | null;
  pph_due_day: number;
  ppn_enabled: boolean;
  prices_include_ppn: boolean;
};

export async function getTaxSettings(): Promise<TaxSettings> {
  const s = await createClient();
  const [row, flags] = await Promise.all([
    s.from("tax_settings").select("business_form, is_pkp, pph_mode, pph_final_rate, general_rate, annual_ceiling, free_threshold, facility_end_date, pph_due_day").maybeSingle(),
    s.from("settings").select("key, value").in("key", ["ppn_enabled", "prices_include_ppn"]),
  ]);
  const r = must<Omit<TaxSettings, "ppn_enabled" | "prices_include_ppn"> | null>(row, "pengaturan pajak");
  if (!r) throw new Error("Pengaturan pajak belum ada untuk cabang ini");
  const f = new Map(must<{ key: string; value: unknown }[]>(flags, "saklar pajak").map((x) => [x.key, x.value === true]));
  return {
    ...r,
    pph_final_rate: num(r.pph_final_rate),
    general_rate: num(r.general_rate),
    annual_ceiling: num(r.annual_ceiling),
    free_threshold: num(r.free_threshold),
    ppn_enabled: f.get("ppn_enabled") ?? false,
    prices_include_ppn: f.get("prices_include_ppn") ?? false,
  };
}

export type TaxRate = { id: string; rate_percent: number; dpp_numerator: number; dpp_denominator: number; valid_from: string; valid_to: string | null };

export async function listTaxRates(): Promise<TaxRate[]> {
  const s = await createClient();
  return must<TaxRate[]>(await s.from("tax_rates").select("id, rate_percent, dpp_numerator, dpp_denominator, valid_from, valid_to").order("valid_from", { ascending: false }), "tarif pajak").map(
    (r) => ({ ...r, rate_percent: num(r.rate_percent) }),
  );
}

export type TaxMonth = { month: number; omzet: number; cumulative: number; taxable: number; pph: number; summary_id: string | null; posted: boolean; posted_pph: number | null };

export async function getTaxOverview(year: number): Promise<TaxMonth[]> {
  const s = await createClient();
  return must<TaxMonth[]>(await s.rpc("tax_overview", { p_year: year }), "ringkasan PPh").map((r) => ({
    ...r,
    omzet: num(r.omzet),
    cumulative: num(r.cumulative),
    taxable: num(r.taxable),
    pph: num(r.pph),
    posted_pph: r.posted_pph == null ? null : num(r.posted_pph),
  }));
}

export type TaxPayment = {
  id: string;
  tax_type: "pph_final" | "ppn";
  period_year: number | null;
  period_month: number | null;
  amount: number;
  pay_date: string;
  reference: string | null;
  status: "posted" | "void";
  void_reason: string | null;
  cash_bank_accounts: { name: string };
};

export async function listTaxPayments(type: "pph_final" | "ppn"): Promise<TaxPayment[]> {
  const s = await createClient();
  return must<TaxPayment[]>(
    await s
      .from("tax_payments")
      .select("id, tax_type, period_year, period_month, amount, pay_date, reference, status, void_reason, cash_bank_accounts(name)")
      .eq("tax_type", type)
      .order("pay_date", { ascending: false })
      .limit(50),
    "setoran pajak",
  ).map((p) => ({ ...p, amount: num(p.amount) }));
}

export async function getPpnSummary(from: string, to: string): Promise<{ keluaran: number; masukan: number; selisih: number; disetor: number }> {
  const s = await createClient();
  const rows = must<{ line: string; amount: number }[]>(await s.rpc("report_ppn", { p_from: from, p_to: to }), "laporan PPN");
  const get = (k: string) => num(rows.find((r) => r.line === k)?.amount);
  return { keluaran: get("keluaran"), masukan: get("masukan"), selisih: get("selisih"), disetor: get("disetor") };
}

export type PpnDocument = { kind: "keluaran" | "retur_keluaran" | "masukan"; doc_id: string; doc_no: string; doc_date: string; party: string; npwp: string | null; dpp: number; ppn: number; total: number };

export async function getPpnDocuments(from: string, to: string): Promise<PpnDocument[]> {
  const s = await createClient();
  return must<PpnDocument[]>(await s.rpc("report_ppn_documents", { p_from: from, p_to: to }), "dokumen PPN").map((d) => ({ ...d, dpp: num(d.dpp), ppn: num(d.ppn), total: num(d.total) }));
}

export async function listCashAccounts() {
  const s = await createClient();
  return must<{ id: string; name: string }[]>(await s.from("cash_bank_accounts").select("id, name").eq("is_active", true).order("kind").order("name"), "akun kas/bank");
}

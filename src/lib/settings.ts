import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SettingsValues } from "@/lib/validation/settings";

/** Setelan operasional bengkel (tabel settings, terbaca semua karyawan; ubah lewat save_settings) */
export async function getSettings(): Promise<SettingsValues> {
  const s = await createClient();
  const { data, error } = await s.from("settings").select("key, value");
  if (error) throw new Error(`Gagal memuat pengaturan: ${error.message}`);
  const m = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const n = (k: string, d: number) => (m.has(k) ? Number(m.get(k)) : d);
  const b = (k: string, d: boolean) => (m.has(k) ? m.get(k) === true : d);
  return {
    discount_limit_cashier: n("discount_limit_cashier", 5),
    discount_limit_admin: n("discount_limit_admin", 10),
    opname_pin_threshold: n("opname_pin_threshold", 500000),
    sales_return_max_days: n("sales_return_max_days", 7),
    allow_negative_stock: b("allow_negative_stock", false),
    part_issue_require_scan: b("part_issue_require_scan", false),
  };
}

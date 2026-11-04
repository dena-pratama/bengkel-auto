import "server-only";
import { createClient } from "@/lib/supabase/server";

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}

export type DueReminder = {
  vehicle_id: string;
  rule_id: string;
  source_wo_id: string;
  plate_no: string;
  vehicle: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  service_name: string;
  last_date: string;
  last_odometer: number | null;
  current_odometer: number | null;
  interval_km: number | null;
  interval_months: number | null;
  due_date: string;
  days_until: number;
  due_by: "waktu" | "km";
};

/** Kendaraan yang jatuh tempo servis berkala dalam N hari (termasuk yang sudah lewat) */
export async function listDueReminders(days: number): Promise<DueReminder[]> {
  const s = await createClient();
  return must<DueReminder[]>(await s.rpc("list_due_reminders", { p_days: days }), "reminder servis");
}

export type ReminderRule = { id: string; service_id: string; service_name: string; service_code: string; interval_km: number | null; interval_months: number | null; is_active: boolean };

export async function listReminderRules(): Promise<ReminderRule[]> {
  const s = await createClient();
  type Row = Omit<ReminderRule, "service_name" | "service_code"> & { services: { name: string; code: string } | null };
  const rows = must<Row[]>(await s.from("service_reminder_rules").select("id, service_id, interval_km, interval_months, is_active, services(name, code)").order("created_at"), "aturan reminder");
  return rows.map(({ services, ...r }) => ({ ...r, service_name: services?.name ?? "Jasa", service_code: services?.code ?? "-" }));
}

export async function listServiceOptions(): Promise<{ id: string; name: string; code: string }[]> {
  const s = await createClient();
  return must<{ id: string; name: string; code: string }[]>(await s.from("services").select("id, name, code").eq("is_active", true).order("name"), "jasa");
}

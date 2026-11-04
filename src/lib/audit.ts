import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca audit log (PRD §18). Hanya pemegang izin audit_log yang lolos RLS.

export type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

export const PAGE_SIZE = 50;

export type AuditFilter = { from: string; to: string; table: string | null; action: string | null; actor: string | null; page: number };

export async function listAuditLogs(f: AuditFilter): Promise<{ rows: AuditRow[]; hasMore: boolean }> {
  const s = await createClient();
  let q = s
    .from("v_audit_logs")
    .select("id, table_name, record_id, action, old_data, new_data, note, created_at, actor_name")
    .gte("created_at", `${f.from}T00:00:00+07:00`)
    .lt("created_at", `${f.to}T23:59:59.999+07:00`)
    .order("created_at", { ascending: false })
    .range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE); // satu baris lebih untuk tahu ada halaman berikutnya
  if (f.table) q = q.eq("table_name", f.table);
  if (f.action) q = q.eq("action", f.action);
  if (f.actor) q = q.eq("actor_employee_id", f.actor);
  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat audit log: ${error.message}`);
  const rows = (data ?? []) as AuditRow[];
  return { rows: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export async function listAuditActors(): Promise<{ id: string; name: string }[]> {
  const s = await createClient();
  const { data, error } = await s.from("employees").select("id, full_name").order("full_name");
  if (error) throw new Error(`Gagal memuat karyawan: ${error.message}`);
  return (data ?? []).map((e) => ({ id: e.id as string, name: e.full_name as string }));
}

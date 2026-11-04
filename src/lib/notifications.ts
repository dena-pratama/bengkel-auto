import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NOTIFICATION_GROUPS, type NotificationGroup, type NotificationItem } from "@/lib/validation/notifications";

type Row = Omit<NotificationItem, "actor_name"> & { employees: { full_name: string } | null };
const COLUMNS = "id, kind, module, severity, title, body, link, created_at, employees:actor_employee_id(full_name)";
const toItem = ({ employees, ...r }: Row): NotificationItem => ({ ...r, actor_name: employees?.full_name ?? null });

/** Notifikasi terbaru dan jumlah belum dibaca (RLS menyaring: izin peran + izin modul asal) */
export async function recentNotifications(limit = 20): Promise<{ items: NotificationItem[]; unread: number; lastReadAt: string | null }> {
  const s = await createClient();
  const [list, summary] = await Promise.all([s.from("notifications").select(COLUMNS).order("created_at", { ascending: false }).limit(limit), s.rpc("my_notification_summary")]);
  if (list.error) throw new Error(`Gagal memuat notifikasi: ${list.error.message}`);
  const sum = (summary.data ?? {}) as { unread?: number; last_read_at?: string | null };
  return { items: (list.data as unknown as Row[]).map(toItem), unread: Number(sum.unread ?? 0), lastReadAt: sum.last_read_at ?? null };
}

export const NOTIFICATION_PAGE = 50;

export async function searchNotifications(f: { from: string | null; to: string | null; group: NotificationGroup | null; severity: string | null; page: number }) {
  const s = await createClient();
  let q = s.from("notifications").select(COLUMNS).order("created_at", { ascending: false }).range(f.page * NOTIFICATION_PAGE, f.page * NOTIFICATION_PAGE + NOTIFICATION_PAGE);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+07:00`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59.999+07:00`);
  if (f.group) q = q.in("module", [...NOTIFICATION_GROUPS[f.group].modules]);
  if (f.severity) q = q.eq("severity", f.severity);
  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat notifikasi: ${error.message}`);
  const rows = (data as unknown as Row[]).map(toItem);
  return { items: rows.slice(0, NOTIFICATION_PAGE), hasMore: rows.length > NOTIFICATION_PAGE };
}

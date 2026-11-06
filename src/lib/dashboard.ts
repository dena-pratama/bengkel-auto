import { can, type UserContext } from "@/lib/auth";
import { getMyOpenShift } from "@/lib/cashier";
import { recentNotifications } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { todayWib } from "@/lib/format";
import type { NotificationItem } from "@/lib/validation/notifications";
import type { WorkOrderStatus } from "@/lib/validation/service";

// Data Beranda (RLS menyaring per peran). Setiap blok null bila peran tidak berhak melihatnya.

export type DashWorkOrder = {
  id: string;
  wo_no: string;
  plate_no: string;
  vehicle_label: string | null;
  services: string;
  complaint: string | null;
  mechanics: string;
  status: WorkOrderStatus;
  minutes_in_status: number;
  is_overdue: boolean;
};

export type DashLowItem = { item_id: string; sku: string; name: string; qty: number; min_stock: number };

export type DashShift = { shift_no: string; opened_at: string; cashier_name: string | null; expected_now: number; cash_in: number; non_cash_in: number };

export type DashboardData = {
  /** true bila data contoh (pratinjau development), bukan dari database */
  sample: boolean;
  workOrders: { active: number; overdue: number; rows: DashWorkOrder[]; mechanicLoad: { name: string; count: number }[] } | null;
  revenue: { month: number; count: number } | null;
  receivable: { outstanding: number; invoices: number } | null;
  lowStock: { count: number; rows: DashLowItem[] } | null;
  notifications: { items: NotificationItem[]; unread: number; lastReadAt: string | null } | null;
  shift: DashShift | null | undefined; // undefined = tidak berhak, null = belum ada shift terbuka
};

const num = (v: unknown) => Number(v ?? 0);

async function safe<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (e) {
    console.error(`[dashboard] ${label}:`, e instanceof Error ? e.message : e);
    return fallback;
  }
}

export async function loadDashboard(ctx: UserContext): Promise<DashboardData> {
  const supabase = await createClient();
  const monthStart = `${todayWib().slice(0, 7)}-01`;

  const [workOrders, revenue, receivable, lowStock, notifications, shift] = await Promise.all([
    can(ctx, "service_orders", "view")
      ? safe<DashboardData["workOrders"]>(
          "work order",
          async () => {
            const r = await supabase
              .from("v_work_orders")
              .select("id, wo_no, plate_no, vehicle_label, services, complaint, mechanics, status, minutes_in_status, is_overdue, status_changed_at")
              .not("status", "in", "(delivered,void)")
              .order("status_changed_at", { ascending: false })
              .limit(200);
            if (r.error) throw new Error(r.error.message);
            const all = (r.data ?? []) as (DashWorkOrder & { status_changed_at: string })[];
            const load = new Map<string, number>();
            for (const w of all) for (const n of w.mechanics.split(", ").filter(Boolean)) load.set(n, (load.get(n) ?? 0) + 1);
            return {
              active: all.length,
              overdue: all.filter((w) => w.is_overdue).length,
              rows: all.slice(0, 6).map((w) => ({ ...w, minutes_in_status: num(w.minutes_in_status) })),
              mechanicLoad: [...load].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
            };
          },
          null,
        )
      : null,
    can(ctx, "finance_reports", "view")
      ? safe<DashboardData["revenue"]>(
          "omzet",
          async () => {
            const r = await supabase.from("v_sales").select("total").eq("status", "posted").gte("sale_date", monthStart).limit(5000);
            if (r.error) throw new Error(r.error.message);
            const rows = (r.data ?? []) as { total: number }[];
            return { month: rows.reduce((a, x) => a + num(x.total), 0), count: rows.length };
          },
          null,
        )
      : null,
    can(ctx, "sales", "view")
      ? safe<DashboardData["receivable"]>(
          "piutang",
          async () => {
            const r = await supabase.from("v_ar_customers").select("outstanding, invoices");
            if (r.error) throw new Error(r.error.message);
            const rows = (r.data ?? []) as { outstanding: number; invoices: number }[];
            return { outstanding: rows.reduce((a, x) => a + num(x.outstanding), 0), invoices: rows.reduce((a, x) => a + num(x.invoices), 0) };
          },
          null,
        )
      : null,
    can(ctx, "master_data", "view")
      ? safe<DashboardData["lowStock"]>(
          "stok menipis",
          async () => {
            const r = await supabase.from("v_low_stock").select("item_id, sku, name, qty, min_stock", { count: "exact" }).order("qty", { ascending: true }).limit(4);
            if (r.error) throw new Error(r.error.message);
            return {
              count: r.count ?? (r.data ?? []).length,
              rows: ((r.data ?? []) as DashLowItem[]).map((x) => ({ ...x, qty: num(x.qty), min_stock: num(x.min_stock) })),
            };
          },
          null,
        )
      : null,
    can(ctx, "notifications", "view", false) ? safe<DashboardData["notifications"]>("notifikasi", () => recentNotifications(5), null) : null,
    can(ctx, "sales", "view")
      ? safe<DashboardData["shift"]>(
          "shift",
          async () => {
            const s = await getMyOpenShift(ctx.employee.id);
            if (!s) return null;
            const cashIn = s.cash_in;
            return {
              shift_no: s.shift_no,
              opened_at: s.opened_at,
              cashier_name: s.cashier_name,
              expected_now: s.expected_now ?? 0,
              cash_in: cashIn,
              non_cash_in: s.transfer_in + s.qris_in + s.card_in,
            };
          },
          undefined,
        )
      : undefined,
  ]);

  return { sample: false, workOrders, revenue, receivable, lowStock, notifications, shift };
}

/** Data contoh untuk pratinjau development tanpa login (bukan data nyata) */
export function sampleDashboard(): DashboardData {
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60000).toISOString();
  return {
    sample: true,
    workOrders: {
      active: 5,
      overdue: 1,
      rows: [
        { id: "1", wo_no: "WO-2611-0014", plate_no: "B 1932 TKA", vehicle_label: "Toyota Avanza 2019", services: "Ganti oli, filter, tune up", complaint: null, mechanics: "Rudi", status: "in_progress", minutes_in_status: 165, is_overdue: true },
        { id: "2", wo_no: "WO-2611-0015", plate_no: "B 1234 KJT", vehicle_label: "Honda Jazz 2016", services: "Ganti kampas rem depan", complaint: null, mechanics: "Andi", status: "waiting_parts", minutes_in_status: 90, is_overdue: false },
        { id: "3", wo_no: "WO-2611-0016", plate_no: "D 1288 XB", vehicle_label: "Suzuki Ertiga 2020", services: "Servis AC dan isi freon", complaint: null, mechanics: "Joko", status: "quality_check", minutes_in_status: 75, is_overdue: false },
      ],
      mechanicLoad: [
        { name: "Rudi", count: 2 },
        { name: "Andi", count: 2 },
        { name: "Joko", count: 1 },
      ],
    },
    revenue: { month: 128_400_000, count: 86 },
    receivable: { outstanding: 24_750_000, invoices: 3 },
    lowStock: {
      count: 8,
      rows: [
        { item_id: "1", sku: "FO-TY-021", name: "Filter Oli Avanza", qty: 3, min_stock: 10 },
        { item_id: "2", sku: "KR-HD-114", name: "Kampas rem depan Jazz", qty: 2, min_stock: 6 },
        { item_id: "3", sku: "OL-SH-1040", name: "Oli 10W-40 1L", qty: 6, min_stock: 24 },
      ],
    },
    notifications: {
      items: [
        { id: "n1", kind: "wo.overdue", module: "service_orders", severity: "danger", title: "WO melewati estimasi", body: "WO-2611-0014 B 1932 TKA", link: "/servis", created_at: ago(35), actor_name: null },
        { id: "n2", kind: "stock.low", module: "master_data", severity: "warn", title: "Stok Filter Oli Avanza menipis", body: "Sisa 3, minimum 10", link: "/inventory", created_at: ago(180), actor_name: null },
        { id: "n3", kind: "sale.posted", module: "sales", severity: "info", title: "Penjualan POS-2611-0042 diposting", body: null, link: "/kasir", created_at: ago(400), actor_name: "Sinta" },
      ],
      unread: 2,
      lastReadAt: ago(120),
    },
    shift: { shift_no: "SH-2611-0003", opened_at: ago(480), cashier_name: "Sinta", expected_now: 4_820_000, cash_in: 3_150_000, non_cash_in: 1_670_000 },
  };
}

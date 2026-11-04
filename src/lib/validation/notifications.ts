// Pengelompokan notifikasi menurut modul asal peristiwa (untuk filter dan label)
export const NOTIFICATION_GROUPS = {
  kasir: { label: "Penjualan dan kasir", modules: ["sales", "cash_shift"] },
  servis: { label: "Servis dan part", modules: ["service_orders", "part_issue"] },
  pembelian: { label: "Pembelian dan hutang", modules: ["purchasing", "payables"] },
  stok: { label: "Stok", modules: ["master_data", "stock_opname_count", "stock_opname_approve"] },
  keuangan: { label: "Keuangan dan pajak", modules: ["expenses", "journal", "tax_settings"] },
  penggajian: { label: "Penggajian", modules: ["payroll"] },
  sistem: { label: "Karyawan dan sistem", modules: ["employees", "settings", "ai_analyst"] },
} as const;
export type NotificationGroup = keyof typeof NOTIFICATION_GROUPS;
export const NOTIFICATION_GROUP_KEYS = Object.keys(NOTIFICATION_GROUPS) as NotificationGroup[];

export const SEVERITIES = ["info", "warn", "danger"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_LABEL: Record<Severity, string> = { info: "Info", warn: "Perlu perhatian", danger: "Penting" };

export type NotificationItem = {
  id: string;
  kind: string;
  module: string | null;
  severity: Severity;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  actor_name: string | null;
};

/** "baru saja", "5 mnt lalu", "3 j lalu", "2 hr lalu", atau tanggal untuk yang lebih lama */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "baru saja";
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} j lalu`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} hr lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

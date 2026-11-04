import type { PermissionAction } from "@/lib/auth";

export type NavGroup = "operasional" | "keuangan" | "sdm";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // nama ikon lucide, dipetakan di komponen klien
  module?: string;
  action?: PermissionAction;
  ready: boolean;
  /** Kelompok menu di sidebar; tanpa kelompok = di atas (Beranda) */
  group?: NavGroup;
  /** Lencana angka dari data nyata (diisi di RailView) atau teks tetap */
  badge?: "work_orders" | "low_stock" | "new";
};

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  operasional: "Operasional",
  keuangan: "Keuangan",
  sdm: "SDM & Sistem",
};

/** Menu utama sesuai desain Figma: Beranda, lalu Operasional, Keuangan, SDM & Sistem.
 *  Pengaturan dan Keluar ada di bagian bawah sidebar. `ready: false` = modul belum dibangun. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: "home", ready: true },
  { href: "/servis", label: "Servis & Work Order", icon: "wrench", module: "service_orders", ready: true, group: "operasional", badge: "work_orders" },
  { href: "/kasir", label: "Kasir", icon: "cart", module: "sales", ready: true, group: "operasional" },
  { href: "/inventory", label: "Barang & Jasa", icon: "package", module: "master_data", ready: true, group: "operasional", badge: "low_stock" },
  { href: "/pembelian", label: "Pembelian", icon: "truck", module: "purchasing", ready: true, group: "operasional" },
  { href: "/pelanggan", label: "Pelanggan", icon: "users", module: "customers", ready: true, group: "operasional" },
  { href: "/stok-opname", label: "Stok Opname", icon: "clipboard", module: "stock_opname_count", ready: true, group: "operasional" },
  { href: "/keuangan", label: "Keuangan", icon: "wallet", module: "expenses", ready: true, group: "keuangan" },
  { href: "/penggajian", label: "Penggajian", icon: "banknote", module: "payroll", ready: true, group: "keuangan" },
  { href: "/pajak", label: "Pajak", icon: "receipt", module: "tax_settings", ready: true, group: "keuangan" },
  { href: "/karyawan", label: "Karyawan", icon: "userCog", module: "employees", ready: true, group: "sdm" },
  { href: "/ai", label: "AI Analyst", icon: "bot", module: "ai_analyst", ready: true, group: "sdm", badge: "new" },
  { href: "/audit", label: "Audit Log", icon: "history", module: "audit_log", ready: true, group: "sdm" },
];

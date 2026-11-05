import type { PermissionAction } from "@/lib/auth";

export type NavGroup = "operasional" | "keuangan" | "sdm";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // nama ikon lucide, dipetakan di komponen klien
  module?: string;
  action?: PermissionAction;
  /** Kelompok menu di sidebar; tanpa kelompok = di atas (Beranda) */
  group?: NavGroup;
};

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  operasional: "Operasional",
  keuangan: "Keuangan",
  sdm: "SDM & Sistem",
};

/** Menu utama sesuai desain Figma: Beranda, lalu Operasional, Keuangan, SDM & Sistem.
 *  Pengaturan dan Keluar ada di bagian bawah sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: "home" },
  { href: "/servis", label: "Servis & Work Order", icon: "wrench", module: "service_orders", group: "operasional" },
  { href: "/kasir", label: "Kasir", icon: "cart", module: "sales", group: "operasional" },
  { href: "/inventory", label: "Barang & Jasa", icon: "package", module: "master_data", group: "operasional" },
  { href: "/pembelian", label: "Pembelian", icon: "truck", module: "purchasing", group: "operasional" },
  { href: "/pelanggan", label: "Pelanggan", icon: "users", module: "customers", group: "operasional" },
  { href: "/stok-opname", label: "Stok Opname", icon: "clipboard", module: "stock_opname_count", group: "operasional" },
  { href: "/keuangan", label: "Keuangan", icon: "wallet", module: "expenses", group: "keuangan" },
  { href: "/penggajian", label: "Penggajian", icon: "banknote", module: "payroll", group: "keuangan" },
  { href: "/pajak", label: "Pajak", icon: "receipt", module: "tax_settings", group: "keuangan" },
  { href: "/karyawan", label: "Karyawan", icon: "userCog", module: "employees", group: "sdm" },
  { href: "/ai", label: "AI Analyst", icon: "bot", module: "ai_analyst", group: "sdm" },
  { href: "/audit", label: "Audit Log", icon: "history", module: "audit_log", group: "sdm" },
];

import type { PermissionAction } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: string; // nama ikon lucide, dipetakan di komponen klien
  module?: string;
  action?: PermissionAction;
  ready: boolean;
};

/** Menu utama, urutan mengikuti modul PRD. `ready: false` = modul belum dibangun.
 *  Pengaturan & profil ada di top bar (menu profil), bukan di sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Beranda", icon: "home", ready: true },
  { href: "/servis", label: "Servis & Work Order", icon: "wrench", module: "service_orders", ready: true },
  { href: "/kasir", label: "Kasir", icon: "cart", module: "sales", ready: true },
  { href: "/inventory", label: "Barang & Jasa", icon: "package", module: "master_data", ready: true },
  { href: "/pembelian", label: "Pembelian", icon: "truck", module: "purchasing", ready: true },
  { href: "/pelanggan", label: "Pelanggan", icon: "users", module: "customers", ready: true },
  { href: "/stok-opname", label: "Stok Opname", icon: "clipboard", module: "stock_opname_count", ready: true },
  { href: "/karyawan", label: "Karyawan", icon: "userCog", module: "employees", ready: true },
  { href: "/penggajian", label: "Penggajian", icon: "banknote", module: "payroll", ready: true },
  { href: "/keuangan", label: "Keuangan", icon: "wallet", module: "expenses", ready: true },
  { href: "/pajak", label: "Pajak", icon: "receipt", module: "tax_settings", ready: true },
  { href: "/ai", label: "AI Analyst", icon: "bot", module: "ai_analyst", ready: true },
  { href: "/audit", label: "Audit Log", icon: "history", module: "audit_log", ready: true },
];

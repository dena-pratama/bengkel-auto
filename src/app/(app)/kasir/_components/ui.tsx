import { Receipt, Timer, Wallet, WalletCards } from "lucide-react";
import { SectionNav } from "@/components/page-kit";
import type { SaleStatus } from "@/lib/cashier";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "cashier", href: "/kasir", label: "Kasir", icon: WalletCards },
  { key: "sales", href: "/kasir/penjualan", label: "Penjualan & invoice", icon: Receipt },
  { key: "ar", href: "/kasir/piutang", label: "Piutang", icon: Wallet },
  { key: "shifts", href: "/kasir/shift", label: "Shift kas", icon: Timer },
] as const;

export function CashierNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return <SectionNav tabs={TABS} active={active} label="Bagian kasir" />;
}

const STATUS_STYLE: Record<SaleStatus, string> = {
  draft: "bg-brand-sand-soft text-foreground",
  posted: "bg-brand-blue-soft text-brand-blue-fg",
  void: "bg-brand-red-soft text-brand-red",
};
const STATUS_LABEL: Record<SaleStatus, string> = { draft: "Ditahan", posted: "Diposting", void: "Dibatalkan" };

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function PaidBadge({ total, outstanding, overdue }: { total: number; outstanding: number; overdue: number | null }) {
  if (outstanding <= 0) return <span className="rounded-sm bg-brand-blue-ink px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white">Lunas</span>;
  if (overdue != null && overdue > 0) return <span className="rounded-sm bg-brand-red px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white">Lewat {overdue} hari</span>;
  return (
    <span className="rounded-sm bg-brand-sand-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap">{outstanding < total ? "Dibayar sebagian" : "Belum dibayar"}</span>
  );
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

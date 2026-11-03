import { ClipboardList, PackageCheck, Truck, Wallet } from "lucide-react";
import { SectionNav, inputClass } from "@/components/page-kit";
import { PO_STATUS_LABEL } from "@/lib/validation/purchasing";
import type { PoStatus } from "@/lib/purchasing";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "po", href: "/pembelian", label: "Purchase order", icon: ClipboardList },
  { key: "receipts", href: "/pembelian/penerimaan", label: "Penerimaan barang", icon: PackageCheck },
  { key: "payables", href: "/pembelian/hutang", label: "Hutang supplier", icon: Wallet },
  { key: "suppliers", href: "/pembelian/supplier", label: "Supplier", icon: Truck },
] as const;

export function PurchasingNav({ active, showPayables }: { active: (typeof TABS)[number]["key"]; showPayables: boolean }) {
  return <SectionNav tabs={TABS.filter((t) => t.key !== "payables" || showPayables)} active={active} label="Bagian pembelian" />;
}

const STATUS_STYLE: Record<PoStatus, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-brand-blue-soft text-brand-blue-fg",
  partial: "bg-brand-sand-soft text-foreground",
  received: "bg-brand-blue-ink text-white",
  closed: "bg-muted text-muted-foreground",
  cancelled: "bg-brand-red-soft text-brand-red",
};

export function PoStatusBadge({ status }: { status: PoStatus }) {
  return <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>{PO_STATUS_LABEL[status]}</span>;
}

export function DueBadge({ daysOverdue }: { daysOverdue: number }) {
  if (daysOverdue > 0) return <span className="rounded-sm bg-brand-red px-2 py-0.5 text-xs font-medium text-white">Lewat {daysOverdue} hari</span>;
  if (daysOverdue >= -3) return <span className="rounded-sm bg-brand-red-soft px-2 py-0.5 text-xs font-medium text-brand-red">{daysOverdue === 0 ? "Jatuh tempo hari ini" : `${-daysOverdue} hari lagi`}</span>;
  return <span className="rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">{-daysOverdue} hari lagi</span>;
}

/** Label + select bawaan browser (andal di HP) */
export function SelectField({ id, label, error, children, ...props }: React.ComponentProps<"select"> & { label: string; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} aria-invalid={Boolean(error)} className={inputClass} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

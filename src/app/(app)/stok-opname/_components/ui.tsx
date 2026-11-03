import type { OpnameStatus, OpnameType, VarianceReason } from "@/lib/validation/stock-opname";
import { OPNAME_STATUS_LABEL, OPNAME_TYPE_LABEL, VARIANCE_REASON_LABEL } from "@/lib/validation/stock-opname";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<OpnameStatus, string> = {
  draft: "bg-brand-sand-soft text-foreground",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  review: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  posted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  void: "bg-brand-red-soft text-brand-red",
};

export function OpnameStatusBadge({ status }: { status: OpnameStatus }) {
  return (
    <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", STATUS_STYLE[status])}>
      {OPNAME_STATUS_LABEL[status] ?? status}
    </span>
  );
}

const TYPE_STYLE: Record<OpnameType, string> = {
  full: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300",
  location: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
  category: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  cycle_count: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300",
};

export function OpnameTypeBadge({ type }: { type: OpnameType }) {
  return (
    <span className={cn("inline-flex rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap", TYPE_STYLE[type])}>
      {OPNAME_TYPE_LABEL[type] ?? type}
    </span>
  );
}

export function VarianceReasonBadge({ reason }: { reason: VarianceReason | null }) {
  if (!reason) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="inline-flex rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground whitespace-nowrap">
      {VARIANCE_REASON_LABEL[reason] ?? reason}
    </span>
  );
}

export function formatRp(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

export function formatQty(qty: number): string {
  return qty.toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

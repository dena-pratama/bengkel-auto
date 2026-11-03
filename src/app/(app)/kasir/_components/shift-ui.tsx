import { cn } from "@/lib/utils";

const STYLE = {
  open: "bg-brand-blue-soft text-brand-blue-fg",
  closed: "bg-brand-sand-soft text-foreground",
  approved: "bg-brand-blue-ink text-white",
} as const;
const LABEL = { open: "Terbuka", closed: "Menunggu persetujuan", approved: "Disetujui" } as const;

export function ShiftStatusBadge({ status }: { status: keyof typeof STYLE }) {
  return <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", STYLE[status])}>{LABEL[status]}</span>;
}

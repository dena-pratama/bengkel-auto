import { ClipboardList, KanbanSquare } from "lucide-react";
import { SectionNav } from "@/components/page-kit";
import { ESTIMATE_STATUS_LABEL, WO_STATUS_LABEL, type EstimateStatus, type WorkOrderStatus } from "@/lib/validation/service";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "board", href: "/servis", label: "Papan & work order", icon: KanbanSquare },
  { key: "estimates", href: "/servis/estimasi", label: "Estimasi", icon: ClipboardList },
] as const;

export function ServiceNav({ active, showEstimates }: { active: (typeof TABS)[number]["key"]; showEstimates: boolean }) {
  return <SectionNav tabs={TABS.filter((t) => t.key !== "estimates" || showEstimates)} active={active} label="Bagian servis" />;
}

export const WO_STATUS_STYLE: Record<WorkOrderStatus, string> = {
  queued: "bg-muted text-foreground",
  in_progress: "bg-brand-blue-soft text-brand-blue-fg",
  waiting_parts: "bg-brand-sand-soft text-foreground",
  waiting_approval: "bg-brand-sand text-foreground",
  quality_check: "bg-brand-blue text-white",
  ready: "bg-brand-blue-ink text-white",
  delivered: "bg-muted text-muted-foreground",
  void: "bg-brand-red-soft text-brand-red",
};

export function WoStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", WO_STATUS_STYLE[status])}>{WO_STATUS_LABEL[status]}</span>;
}

const EST_STYLE: Record<EstimateStatus, string> = {
  draft: "bg-muted text-foreground",
  sent: "bg-brand-blue-soft text-brand-blue-fg",
  approved: "bg-brand-blue-ink text-white",
  rejected: "bg-brand-red-soft text-brand-red",
  revised: "bg-muted text-muted-foreground",
  converted: "bg-brand-sand-soft text-foreground",
  void: "bg-brand-red-soft text-brand-red",
};

export function EstimateStatusBadge({ status }: { status: EstimateStatus }) {
  return <span className={cn("inline-flex rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap", EST_STYLE[status])}>{ESTIMATE_STATUS_LABEL[status]}</span>;
}

export function WarrantyBadge() {
  return <span className="inline-flex rounded-sm bg-brand-red px-2 py-0.5 text-xs font-medium text-white">Garansi</span>;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

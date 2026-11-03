import { Banknote, HandCoins, Medal, UserCog } from "lucide-react";
import { SectionNav } from "@/components/page-kit";
import type { PayrollStatus } from "@/lib/payroll";
import { STATUS_LABEL } from "@/lib/validation/payroll";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "periods", href: "/penggajian", label: "Gaji", icon: Banknote },
  { key: "loans", href: "/penggajian/kasbon", label: "Kasbon", icon: HandCoins },
  { key: "commissions", href: "/penggajian/komisi", label: "Komisi", icon: Medal },
  { key: "profiles", href: "/penggajian/profil", label: "Profil gaji", icon: UserCog },
] as const;

export function PayrollNav({ active, showAll }: { active: (typeof TABS)[number]["key"]; showAll: boolean }) {
  return <SectionNav tabs={TABS.filter((t) => showAll || t.key === "periods" || t.key === "loans" || t.key === "commissions")} active={active} label="Bagian penggajian" />;
}

const STYLE: Record<PayrollStatus, string> = {
  draft: "bg-muted text-foreground",
  review: "bg-brand-sand-soft text-foreground",
  approved: "bg-brand-blue-soft text-brand-blue-fg",
  paid: "bg-brand-rail text-white",
  void: "bg-brand-red-soft text-brand-red",
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

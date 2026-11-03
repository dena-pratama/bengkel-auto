import { Percent, Receipt, Settings2 } from "lucide-react";
import { SectionNav } from "@/components/page-kit";

const TABS = [
  { key: "settings", href: "/pajak", label: "Pengaturan", icon: Settings2 },
  { key: "ppn", href: "/pajak/ppn", label: "PPN", icon: Receipt },
  { key: "pph", href: "/pajak/pph", label: "PPh", icon: Percent },
] as const;

export function TaxNav({ active }: { active: (typeof TABS)[number]["key"] }) {
  return <SectionNav tabs={TABS} active={active} label="Bagian pajak" />;
}

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

import { Layers, Package, Settings2, Wrench } from "lucide-react";
import { SectionNav } from "@/components/page-kit";

const TABS = [
  { key: "items", href: "/inventory", label: "Barang", icon: Package },
  { key: "services", href: "/inventory/jasa", label: "Jasa", icon: Wrench },
  { key: "packages", href: "/inventory/paket", label: "Paket servis", icon: Layers },
  { key: "master", href: "/inventory/master", label: "Kategori, satuan & lokasi", icon: Settings2 },
] as const;

export type InventorySection = (typeof TABS)[number]["key"];

export function InventoryNav({ active }: { active: InventorySection }) {
  return <SectionNav tabs={TABS} active={active} label="Bagian barang & jasa" />;
}


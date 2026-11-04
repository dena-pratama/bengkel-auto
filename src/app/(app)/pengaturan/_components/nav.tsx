import { Store, UserRound } from "lucide-react";
import { SectionNav } from "@/components/page-kit";

const TABS = [
  { key: "profile", href: "/pengaturan", label: "Profil saya", icon: UserRound },
  { key: "shop", href: "/pengaturan/bengkel", label: "Bengkel", icon: Store },
] as const;

export function SettingsNav({ active, showShop }: { active: (typeof TABS)[number]["key"]; showShop: boolean }) {
  return <SectionNav tabs={TABS.filter((t) => t.key !== "shop" || showShop)} active={active} label="Bagian pengaturan" />;
}

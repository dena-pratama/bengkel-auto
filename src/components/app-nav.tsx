"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard,
  wrench: Wrench,
  cart: ShoppingCart,
  package: Package,
  truck: Truck,
  users: Users,
  clipboard: ClipboardCheck,
  userCog: UserCog,
  wallet: Wallet,
  receipt: Receipt,
  bot: Bot,
  settings: Settings,
};

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (!item.ready) {
          return (
            <span
              key={item.href}
              title="Modul segera hadir"
              aria-disabled
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-400"
            >
              <Icon className="size-4" />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="rounded-full bg-brand-sand-soft px-1.5 py-0.5 text-[10px] text-[#8a7a4e]">Segera</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              active
                ? "bg-brand-red font-medium text-white shadow-sm shadow-brand-red/30"
                : "text-zinc-700 hover:bg-brand-sand-soft",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Buka menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-background p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-left text-base">Bengkel Mobil App</SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <NavLinks items={items} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

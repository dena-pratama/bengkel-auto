"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ClipboardCheck,
  LayoutGrid,
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
  home: LayoutGrid,
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

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigasi ikon di pita biru (tablet & desktop). Label muncul sebagai tooltip. */
export function IconNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col items-center gap-2" aria-label="Menu utama">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutGrid;
        const active = isActive(item.href);
        const tile = cn(
          "group relative flex size-11 items-center justify-center rounded-xl transition-colors",
          active ? "bg-white text-brand-blue-ink shadow-md" : "text-white/80 hover:bg-white/12 hover:text-white",
          !item.ready && "cursor-not-allowed text-white/45 hover:bg-transparent hover:text-white/45",
        );
        const content = (
          <>
            <Icon className="size-5" />
            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-visible:block">
              {item.label}
              {!item.ready && <span className="ml-1 text-white/60">· segera</span>}
            </span>
          </>
        );
        return item.ready ? (
          <Link key={item.href} href={item.href} className={tile} aria-label={item.label} aria-current={active ? "page" : undefined}>
            {content}
          </Link>
        ) : (
          <span key={item.href} className={tile} aria-label={`${item.label} (segera)`} aria-disabled tabIndex={0}>
            {content}
          </span>
        );
      })}
    </nav>
  );
}

/** Menu lengkap dengan label (HP). */
export function MobileNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive();
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-0 bg-brand-blue-ink p-0 text-white">
        <SheetHeader className="border-b border-white/15 px-4 py-4">
          <SheetTitle className="text-left text-base text-white">Bengkel Mobil App</SheetTitle>
        </SheetHeader>
        <nav className="grid gap-1 p-3">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutGrid;
            const active = isActive(item.href);
            const row = cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              active ? "bg-white font-medium text-brand-blue-ink" : "text-white/90",
              !item.ready && "text-white/50",
            );
            return item.ready ? (
              <Link key={item.href} href={item.href} className={row}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            ) : (
              <span key={item.href} className={row} aria-disabled>
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Segera</span>
              </span>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { createContext, use, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ClipboardCheck,
  LayoutGrid,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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

const STORAGE_KEY = "bk_sidebar_open";
const DESKTOP_QUERY = "(min-width: 1024px)";
const STORAGE_EVENT = "bk-sidebar-change";

// Preferensi desktop disimpan di localStorage; dibaca sebagai external store
function subscribeDesktopPref(onChange: () => void) {
  window.addEventListener(STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function readDesktopPref() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}
function subscribeViewport(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const readIsDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

function writeDesktopPref(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

type SidebarState = { open: boolean; toggle: () => void; close: () => void };
const SidebarContext = createContext<SidebarState | null>(null);

function useSidebar() {
  const ctx = use(SidebarContext);
  if (!ctx) throw new Error("useSidebar harus di dalam SidebarFrame");
  return ctx;
}

/**
 * Kerangka dengan sidebar melayang (floating) yang bisa ditampilkan/disembunyikan.
 * Desktop (≥1024px): default tampil, konten bergeser; pilihan disimpan di browser.
 * Tablet & HP: default tersembunyi, muncul di atas konten dengan latar gelap.
 * Pintasan: Ctrl/⌘ + B.
 */
export function SidebarFrame({
  sidebar,
  topbar,
  children,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const desktopOpen = useSyncExternalStore(subscribeDesktopPref, readDesktopPref, () => true);
  const isDesktopView = useSyncExternalStore(subscribeViewport, readIsDesktop, () => true);
  // HP: panel terbuka untuk path tertentu saja → pindah halaman otomatis menutupnya
  const pathname = usePathname();
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const mobileOpen = mobileOpenAt === pathname;
  const setMobileOpen = useCallback((open: boolean) => setMobileOpenAt(open ? pathname : null), [pathname]);
  // Animasi baru aktif setelah preferensi terbaca, agar tidak "melompat" saat halaman dimuat
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);


  const toggle = useCallback(() => {
    if (readIsDesktop()) writeDesktopPref(!readDesktopPref());
    else setMobileOpenAt((at) => (at === pathname ? null : pathname));
  }, [pathname]);

  const close = useCallback(() => {
    if (readIsDesktop()) toggle();
    else setMobileOpen(false);
  }, [toggle, setMobileOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, mobileOpen, setMobileOpen]);

  return (
    <SidebarContext value={{ open: isDesktopView ? desktopOpen : mobileOpen, toggle, close }}>
      <div className="relative flex min-h-full flex-1 bg-background">
        {/* Latar gelap (HP) */}
        <div
          aria-hidden
          onClick={() => setMobileOpen(false)}
          className={cn(
            "fixed inset-0 z-30 bg-foreground/30 backdrop-blur-[2px] transition-opacity lg:hidden",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />

        <aside
          id="app-sidebar"
          aria-label="Sidebar"
          className={cn(
            "fixed top-3 bottom-3 left-3 z-40 flex w-[248px] flex-col rounded-[28px] bg-brand-blue-ink text-white shadow-2xl shadow-brand-blue-deep/30",
            ready && "transition-[translate,opacity] duration-300 ease-out",
            mobileOpen ? "max-lg:translate-x-0" : "max-lg:pointer-events-none max-lg:-translate-x-[calc(100%+1.5rem)] max-lg:opacity-0",
            desktopOpen ? "lg:translate-x-0" : "lg:pointer-events-none lg:-translate-x-[calc(100%+1.5rem)] lg:opacity-0",
          )}
        >
          {sidebar}
        </aside>

        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            ready && "transition-[padding] duration-300 ease-out",
            desktopOpen ? "lg:pl-[264px]" : "lg:pl-0",
          )}
        >
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur sm:px-6">
            {topbar}
          </header>
          <main className="min-w-0 flex-1 px-3 pt-4 pb-8 sm:px-6">{children}</main>
        </div>
      </div>
    </SidebarContext>
  );
}

/** Tombol tampil/sembunyikan sidebar (di top bar). */
export function SidebarToggle() {
  const { open, toggle } = useSidebar();
  const Icon = open ? PanelLeftClose : PanelLeftOpen;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-controls="app-sidebar"
      aria-expanded={open}
      aria-label={open ? "Sembunyikan menu" : "Tampilkan menu"}
      title={`${open ? "Sembunyikan" : "Tampilkan"} menu (Ctrl+B)`}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-brand-blue-soft hover:text-brand-blue-ink"
    >
      <Icon className="size-5" />
    </button>
  );
}

/** Tombol tutup di dalam sidebar. */
export function SidebarClose() {
  const { close } = useSidebar();
  return (
    <button
      type="button"
      onClick={close}
      aria-label="Sembunyikan menu"
      title="Sembunyikan menu (Ctrl+B)"
      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/12 hover:text-white"
    >
      <PanelLeftClose className="size-[18px]" />
    </button>
  );
}

/** Daftar menu berlabel di sidebar. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="grid gap-1" aria-label="Menu utama">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutGrid;
        const active = isActive(item.href);
        const row = cn(
          "group flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-white font-semibold text-brand-blue-ink shadow-md"
            : item.ready
              ? "text-white/85 hover:bg-white/12 hover:text-white"
              : "cursor-not-allowed text-white/45",
        );
        const icon = (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors",
              active ? "bg-brand-red text-white" : "bg-white/8 group-hover:bg-white/15",
            )}
          >
            <Icon className="size-4" />
          </span>
        );
        return item.ready ? (
          <Link key={item.href} href={item.href} className={row} aria-current={active ? "page" : undefined}>
            {icon}
            <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        ) : (
          <span key={item.href} className={row} aria-disabled>
            {icon}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">Segera</span>
          </span>
        );
      })}
    </nav>
  );
}

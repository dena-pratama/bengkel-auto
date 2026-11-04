"use client";

import { createContext, use, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Bot,
  History,
  ClipboardCheck,
  LayoutGrid,
  Menu,
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
  banknote: Banknote,
  receipt: Receipt,
  bot: Bot,
  history: History,
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
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
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

type SidebarState = { mobileOpen: boolean; toggle: () => void; closeMobile: () => void };
const SidebarContext = createContext<SidebarState | null>(null);

function useSidebar() {
  const ctx = use(SidebarContext);
  if (!ctx) throw new Error("useSidebar harus di dalam SidebarFrame");
  // Baca store langsung (bukan lewat context) agar tombol di dalam Suspense yang di-hydrate
  // belakangan tetap memakai snapshot server saat hydrate → tidak ada hydration mismatch.
  const desktopOpen = useSyncExternalStore(subscribeDesktopPref, readDesktopPref, () => false);
  const isDesktopView = useSyncExternalStore(subscribeViewport, readIsDesktop, () => true);
  return { open: isDesktopView ? desktopOpen : ctx.mobileOpen, toggle: ctx.toggle, closeMobile: ctx.closeMobile };
}

/**
 * Kerangka dengan sidebar melayang (floating) yang bisa dibentangkan/diciutkan.
 * Desktop (≥1024px): bentang = panel berlabel 264px, ciut = rail ikon; konten bergeser; pilihan disimpan di browser.
 * Tablet (768-1023px): default rail ikon; saat dibentangkan muncul di atas konten dengan latar gelap.
 * HP (<768px): tersembunyi; dibuka lewat tombol menu di top bar.
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
  const desktopOpen = useSyncExternalStore(subscribeDesktopPref, readDesktopPref, () => false);
  const isDesktopView = useSyncExternalStore(subscribeViewport, readIsDesktop, () => true);
  // Tablet/HP: panel overlay; ditutup saat link menu diklik (SideNav), klik latar, atau Esc.
  // Sengaja tanpa usePathname di sini: kerangka ada di luar Suspense (wajib untuk route dinamis).
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  // Animasi baru aktif setelah preferensi terbaca, agar tidak "melompat" saat halaman dimuat
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback(() => {
    if (readIsDesktop()) writeDesktopPref(!readDesktopPref());
    else setMobileOpen((v) => !v);
  }, []);

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
  }, [toggle, mobileOpen]);

  const open = isDesktopView ? desktopOpen : mobileOpen;

  return (
    <SidebarContext value={{ mobileOpen, toggle, closeMobile }}>
      <div className="flex min-h-full flex-1 flex-col md:h-dvh md:flex-none md:overflow-hidden md:p-4 lg:p-5 print:h-auto! print:overflow-visible!">
        <div className="relative flex flex-1 md:min-h-0 md:rounded-[40px] md:bg-brand-rail md:p-3 md:shadow-2xl md:shadow-brand-blue-deep/30 md:ring-1 md:ring-white/10">
        {/* Latar gelap (tablet & HP) */}
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
          data-collapsed={!open}
          className={cn(
            "group/sb z-40 flex flex-col text-white",
            "max-md:fixed max-md:top-3 max-md:bottom-3 max-md:left-3 max-md:rounded-[36px] max-md:bg-brand-rail max-md:shadow-2xl max-md:shadow-brand-blue-ink/30",
            "md:h-full md:shrink-0",
            ready && "transition-[width,translate,opacity] duration-300 ease-out",
            mobileOpen ? "max-md:w-[264px]" : "max-md:w-[72px] max-md:pointer-events-none max-md:-translate-x-[calc(100%+1.5rem)] max-md:opacity-0",
            open ? "md:w-[264px]" : "md:w-[72px]",
          )}
        >
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-background md:min-h-0 md:overflow-y-auto md:overscroll-contain md:rounded-[30px] md:[scrollbar-color:var(--border)_transparent] md:[scrollbar-width:thin] print:overflow-visible! print:rounded-none">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background/85 px-3 backdrop-blur md:rounded-t-[30px] sm:px-6">
            {topbar}
          </header>
          <main className="min-w-0 flex-1 px-3 pt-2 pb-8 sm:px-6">{children}</main>
        </div>
        </div>
      </div>
    </SidebarContext>
  );
}

/** Tombol buka menu di top bar: hanya HP; di layar lebih besar rail ikon selalu tampil. */
export function SidebarToggle() {
  const { open, toggle } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-controls="app-sidebar"
      aria-expanded={open}
      aria-label="Buka menu"
      title="Buka menu"
      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-brand-blue-soft hover:text-brand-blue-fg md:hidden"
    >
      <Menu className="size-5" />
    </button>
  );
}

/** Tombol bentangkan/ciutkan di dalam sidebar. */
export function SidebarRailToggle() {
  const { open, toggle } = useSidebar();
  const Icon = open ? PanelLeftClose : PanelLeftOpen;
  const label = open ? "Ciutkan menu" : "Bentangkan menu";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-controls="app-sidebar"
      aria-expanded={open}
      aria-label={label}
      title={`${label} (Ctrl+B)`}
      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/12 hover:text-white"
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

// Varian saat sidebar diciutkan (data-collapsed="true" di <aside>)
const RAIL_ROW = "group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0 group-data-[collapsed=true]/sb:py-1.5";
const RAIL_TOOLTIP = [
  "group-data-[collapsed=true]/sb:pointer-events-none group-data-[collapsed=true]/sb:absolute group-data-[collapsed=true]/sb:left-full group-data-[collapsed=true]/sb:z-50",
  "group-data-[collapsed=true]/sb:ml-4 group-data-[collapsed=true]/sb:hidden group-data-[collapsed=true]/sb:overflow-visible group-data-[collapsed=true]/sb:rounded-lg",
  "group-data-[collapsed=true]/sb:bg-foreground group-data-[collapsed=true]/sb:px-2.5 group-data-[collapsed=true]/sb:py-1.5 group-data-[collapsed=true]/sb:text-xs",
  "group-data-[collapsed=true]/sb:font-medium group-data-[collapsed=true]/sb:whitespace-nowrap group-data-[collapsed=true]/sb:text-white group-data-[collapsed=true]/sb:shadow-lg",
  "group-data-[collapsed=true]/sb:group-hover:block group-data-[collapsed=true]/sb:group-focus-visible:block",
].join(" ");

/** Daftar menu di sidebar. Saat diciutkan hanya ikon; label muncul sebagai tooltip. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { closeMobile } = useSidebar();
  const reduce = useReducedMotion();
  // Menu langsung terasa aktif saat diklik, tanpa menunggu halaman tujuan selesai dirender server.
  // Disimpan bersama path asal: begitu path berubah, nilai lama otomatis diabaikan.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const optimistic = clicked && clicked.from === pathname ? clicked.href : null;
  const isActive = (href: string) => (optimistic ? optimistic === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="grid gap-1" aria-label="Menu utama">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutGrid;
        const active = isActive(item.href);
        const row = cn(
          "group relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
          RAIL_ROW,
          active
            ? "font-semibold text-white"
            : item.ready
              ? "text-white/85 hover:bg-white/12 hover:text-white"
              : "cursor-not-allowed text-white/45",
        );
        const icon = (
          <span
            className={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors",
              active ? "bg-brand-red text-white" : "bg-white/8 group-hover:bg-white/15",
            )}
          >
            <Icon className="size-4" />
          </span>
        );
        const label = (
          <span className={cn("relative min-w-0 truncate", !item.ready && "flex-1", RAIL_TOOLTIP)}>
            {item.label}
            {!item.ready && <span className="hidden text-white/60 group-data-[collapsed=true]/sb:inline"> · segera</span>}
          </span>
        );
        return item.ready ? (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              closeMobile();
              setClicked({ href: item.href, from: pathname });
            }}
            className={row}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <motion.span
                layoutId="nav-active-pill"
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-white/14 ring-1 ring-white/15"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36, mass: 0.9 }}
              >
                <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-red" />
              </motion.span>
            )}
            {icon}
            {label}
          </Link>
        ) : (
          <span key={item.href} className={row} aria-label={`${item.label} (segera)`} aria-disabled tabIndex={0}>
            {icon}
            {label}
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-2xs text-white/70 group-data-[collapsed=true]/sb:hidden">
              Segera
            </span>
          </span>
        );
      })}
    </nav>
  );
}

"use client";

import { createContext, use, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  ClipboardCheck,
  History,
  Landmark,
  LayoutGrid,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUP_LABEL, type NavGroup, type NavItem } from "@/lib/navigation";
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
  wallet: Landmark,
  banknote: Banknote,
  receipt: Percent,
  bot: Sparkles,
  history: History,
  settings: Settings,
};

export type NavBadge = { text: string; tone: "muted" | "red" | "blue" };
const BADGE_TONE: Record<NavBadge["tone"], string> = {
  muted: "bg-muted text-muted-foreground",
  red: "bg-brand-red-soft text-brand-red",
  blue: "bg-brand-blue-soft text-brand-blue-fg",
};

const STORAGE_KEY = "bk_sidebar_collapsed";
const DESKTOP_QUERY = "(min-width: 1024px)";
const STORAGE_EVENT = "bk-sidebar-change";

// Preferensi ciut/bentang (desktop) disimpan di localStorage; dibaca sebagai external store
function subscribePref(onChange: () => void) {
  window.addEventListener(STORAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function readCollapsedPref() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeCollapsedPref(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(STORAGE_EVENT));
}
function subscribeViewport(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const readIsDesktop = () => window.matchMedia(DESKTOP_QUERY).matches;

type SidebarState = { drawerOpen: boolean; setDrawerOpen: (v: boolean) => void };
const SidebarContext = createContext<SidebarState | null>(null);

function useSidebar() {
  const ctx = use(SidebarContext);
  if (!ctx) throw new Error("useSidebar harus di dalam SidebarFrame");
  // Baca store langsung (bukan lewat context) agar tombol di dalam Suspense yang di-hydrate
  // belakangan tetap memakai snapshot server saat hydrate (tanpa hydration mismatch).
  const collapsedPref = useSyncExternalStore(subscribePref, readCollapsedPref, () => false);
  const isDesktop = useSyncExternalStore(subscribeViewport, readIsDesktop, () => true);
  const collapsed = isDesktop && collapsedPref;
  const toggleCollapse = useCallback(() => writeCollapsedPref(!readCollapsedPref()), []);
  return { isDesktop, collapsed, drawerOpen: ctx.drawerOpen, setDrawerOpen: ctx.setDrawerOpen, toggleCollapse };
}

/**
 * Kerangka sesuai desain Figma: sidebar terang berbatas kanan + bilah atas + isi halaman.
 * Desktop (>= 1024 px): sidebar menempel 264 px (bisa diciutkan jadi 72 px rail ikon, pilihan disimpan).
 * Di bawah itu: sidebar menjadi drawer dari kiri, dibuka dengan tombol menu di bilah atas.
 * Pintasan: Ctrl/Cmd + B (ciutkan) dan Esc (tutup drawer).
 */
export function SidebarFrame({ sidebar, topbar, children }: { sidebar: React.ReactNode; topbar: React.ReactNode; children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsedPref = useSyncExternalStore(subscribePref, readCollapsedPref, () => false);
  const isDesktop = useSyncExternalStore(subscribeViewport, readIsDesktop, () => true);
  const collapsed = isDesktop && collapsedPref;
  // animasi baru aktif setelah halaman siap agar tidak "melompat" saat dimuat
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (readIsDesktop()) writeCollapsedPref(!readCollapsedPref());
        else setDrawerOpen((v) => !v);
      } else if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <SidebarContext value={{ drawerOpen, setDrawerOpen }}>
      <div className="flex min-h-svh bg-background print:block">
        {/* Latar gelap di belakang drawer */}
        <div
          aria-hidden
          onClick={() => setDrawerOpen(false)}
          className={cn("fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden", drawerOpen ? "opacity-100" : "pointer-events-none opacity-0")}
        />
        <aside
          id="app-sidebar"
          aria-label="Sidebar"
          data-collapsed={collapsed}
          className={cn(
            "group/sb z-50 flex flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground",
            "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[300px] max-lg:max-w-[85vw] max-lg:overflow-y-auto",
            "lg:sticky lg:top-0 lg:h-svh lg:shrink-0",
            ready && "transition-[width,translate] duration-200 ease-out",
            drawerOpen ? "max-lg:translate-x-0 max-lg:shadow-2xl" : "max-lg:-translate-x-full",
            collapsed ? "lg:w-[72px] lg:px-3" : "lg:w-[264px]",
          )}
        >
          {sidebar}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-8 lg:h-[71px]">{topbar}</header>
          <main className="min-w-0 flex-1 px-4 pt-6 pb-10 sm:px-8">{children}</main>
        </div>
      </div>
    </SidebarContext>
  );
}

/** Tombol buka menu di bilah atas (hanya di bawah 1024 px). */
export function SidebarToggle() {
  const { drawerOpen, setDrawerOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-controls="app-sidebar"
      aria-expanded={drawerOpen}
      aria-label="Buka menu"
      className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted lg:hidden"
    >
      <Menu className="size-5" />
    </button>
  );
}

/** Tombol di kepala sidebar: ciutkan/bentangkan (desktop) atau tutup drawer (kecil). */
export function SidebarRailToggle() {
  const { isDesktop, collapsed, toggleCollapse, setDrawerOpen } = useSidebar();
  const Icon = !isDesktop ? X : collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = !isDesktop ? "Tutup menu" : collapsed ? "Bentangkan menu" : "Ciutkan menu";
  return (
    <button
      type="button"
      onClick={() => (isDesktop ? toggleCollapse() : setDrawerOpen(false))}
      aria-controls="app-sidebar"
      aria-label={label}
      title={isDesktop ? `${label} (Ctrl+B)` : label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}

// Varian saat sidebar diciutkan (data-collapsed="true" di <aside>)
const C = "group-data-[collapsed=true]/sb";
const TOOLTIP = [
  `${C}:pointer-events-none ${C}:absolute ${C}:left-full ${C}:z-50 ${C}:ml-3 ${C}:hidden ${C}:rounded-lg`,
  `${C}:bg-foreground ${C}:px-2.5 ${C}:py-1.5 ${C}:text-xs ${C}:font-medium ${C}:whitespace-nowrap ${C}:text-background ${C}:shadow-lg`,
  `${C}:group-hover:block ${C}:group-focus-visible:block`,
].join(" ");

/** Daftar menu bergrup di sidebar. Saat diciutkan hanya ikon; label muncul sebagai tooltip. */
export function SideNav({ items, badges }: { items: NavItem[]; badges: Record<string, NavBadge> }) {
  const pathname = usePathname();
  const { setDrawerOpen } = useSidebar();
  // Menu langsung terasa aktif saat diklik, tanpa menunggu halaman tujuan selesai dirender server.
  const [clicked, setClicked] = useState<{ href: string; from: string } | null>(null);
  const optimistic = clicked && clicked.from === pathname ? clicked.href : null;
  const isActive = (href: string) => (optimistic ? optimistic === href : pathname === href || pathname.startsWith(`${href}/`));

  const groups: { key: NavGroup | "top"; items: NavItem[] }[] = [{ key: "top", items: items.filter((i) => !i.group) }];
  for (const g of ["operasional", "keuangan", "sdm"] as const) {
    const list = items.filter((i) => i.group === g);
    if (list.length) groups.push({ key: g, items: list });
  }

  return (
    <nav className="flex flex-col gap-3.5" aria-label="Menu utama">
      {groups.map((g) => (
        <div key={g.key} className="grid gap-0.5">
          {g.key !== "top" && (
            <>
              <p className={cn("px-3 pb-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase", `${C}:hidden`)}>{NAV_GROUP_LABEL[g.key]}</p>
              <div className={cn("mx-3 mb-1 hidden border-t border-border", `${C}:block`)} />
            </>
          )}
          {g.items.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutGrid;
            const active = isActive(item.href);
            const badge = badges[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setDrawerOpen(false);
                  setClicked({ href: item.href, from: pathname });
                }}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 min-w-0 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  `${C}:justify-center ${C}:px-0`,
                  active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className={cn("min-w-0 flex-1 truncate", TOOLTIP)}>{item.label}</span>
                {badge && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", BADGE_TONE[badge.tone], `${C}:hidden`)}>{badge.text}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Menu bawah sidebar: Pengaturan (tautan) dan slot Keluar. */
export function SettingsLink() {
  const pathname = usePathname();
  const { setDrawerOpen } = useSidebar();
  const active = pathname === "/pengaturan" || pathname.startsWith("/pengaturan/");
  return (
    <Link
      href="/pengaturan"
      onClick={() => setDrawerOpen(false)}
      aria-label="Pengaturan"
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
        `${C}:justify-center ${C}:px-0`,
        active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Settings className="size-[18px] shrink-0" />
      <span className={cn("min-w-0 flex-1 truncate", TOOLTIP)}>Pengaturan</span>
    </Link>
  );
}

import Image from "next/image";
import { LogOut, Search, Settings, Store } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SettingsLink, SideNav, SidebarFrame, SidebarRailToggle, SidebarToggle, type NavBadge } from "@/components/app-nav";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileMenu, ThemeToggle } from "@/components/topbar-controls";
import { can, type UserContext } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Kerangka halaman sesuai desain Figma: sidebar terang (drawer di layar kecil) + bilah atas + isi.
 */
export function AppShell({ rail, topbar, children }: { rail: React.ReactNode; topbar: React.ReactNode; children: React.ReactNode }) {
  return (
    <SidebarFrame sidebar={rail} topbar={topbar}>
      {children}
    </SidebarFrame>
  );
}

export function visibleNavItems(ctx: UserContext) {
  return NAV_ITEMS.filter((item) => !item.module || can(ctx, item.module, item.action ?? "view"));
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Lencana menu dari data nyata: work order aktif dan barang menipis (sesuai izin pengguna). */
async function navBadges(ctx: UserContext): Promise<Record<string, NavBadge>> {
  const badges: Record<string, NavBadge> = { "/ai": { text: "Baru", tone: "blue" } };
  const supabase = await createClient();
  const [wo, low] = await Promise.all([
    can(ctx, "service_orders", "view") ? supabase.from("v_work_orders").select("id", { count: "exact", head: true }).not("status", "in", "(delivered,void)") : null,
    can(ctx, "master_data", "view") ? supabase.from("v_low_stock").select("*", { count: "exact", head: true }) : null,
  ]);
  if (wo && !wo.error && (wo.count ?? 0) > 0) badges["/servis"] = { text: String(wo.count), tone: "muted" };
  if (low && !low.error && (low.count ?? 0) > 0) badges["/inventory"] = { text: String(low.count), tone: "red" };
  return badges;
}

export async function RailView({ ctx }: { ctx: UserContext }) {
  const badges = await navBadges(ctx);
  return (
    <>
      {/* Merek + tombol ciutkan */}
      <div className="flex items-center justify-between gap-2 px-1.5 group-data-[collapsed=true]/sb:flex-col group-data-[collapsed=true]/sb:gap-3 group-data-[collapsed=true]/sb:px-0">
        <span className="flex items-center group-data-[collapsed=true]/sb:hidden">
          <Image src="/brand/automobi-logo.png" alt="AutoMobi" width={671} height={335} className="h-9 w-auto dark:hidden" priority />
          <Image src="/brand/automobi-logo-dark.png" alt="AutoMobi" width={671} height={335} className="hidden h-9 w-auto dark:block" priority />
        </span>
        <span className="hidden size-9 items-center justify-center group-data-[collapsed=true]/sb:flex">
          <Image src="/brand/automobi-mark.png" alt="AutoMobi" width={64} height={64} className="size-8 object-contain" priority />
        </span>
        <SidebarRailToggle />
      </div>

      {/* Cabang (bengkel satu cabang: label saja) */}
      <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-muted/60 px-2.5 py-2 group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0" title={ctx.branch.name}>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground">
          <Store className="size-[15px]" />
        </span>
        <span className="min-w-0 leading-tight group-data-[collapsed=true]/sb:hidden">
          <span className="block text-2xs font-medium text-muted-foreground">Cabang</span>
          <span className="block truncate text-[13px] font-semibold">{ctx.branch.name}</span>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] group-data-[collapsed=true]/sb:overflow-visible">
        <SideNav items={visibleNavItems(ctx)} badges={badges} />
      </div>

      <div className="grid gap-0.5 border-t border-border pt-3">
        <SettingsLink />
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Keluar"
            className="group relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-brand-red transition-colors hover:bg-brand-red-soft group-data-[collapsed=true]/sb:justify-center group-data-[collapsed=true]/sb:px-0"
          >
            <LogOut className="size-[18px] shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left group-data-[collapsed=true]/sb:hidden">Keluar</span>
          </button>
        </form>
      </div>
    </>
  );
}

export function RailSkeleton() {
  return <div className="h-80 animate-pulse rounded-xl bg-muted" />;
}

export function TopbarView({ ctx }: { ctx: UserContext }) {
  return (
    <>
      <SidebarToggle />
      <div className="min-w-0 sm:hidden">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <Store className="size-4 shrink-0 text-muted-foreground" />
          {ctx.branch.name}
        </p>
      </div>

      {/* Pencarian global: tampilan dulu, belum aktif */}
      <label className="hidden h-10 w-full max-w-[400px] items-center gap-2 rounded-lg border border-border bg-card px-3 sm:flex" title="Pencarian global (segera)">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input type="search" readOnly placeholder="Cari no. polisi, WO, barang…" aria-label="Pencarian global (segera)" className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-px text-2xs font-medium text-muted-foreground md:block">Ctrl K</kbd>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell enabled={can(ctx, "notifications", "view", false)} />
        <Button variant="outline" size="icon" className="hidden size-10 text-muted-foreground sm:inline-flex" aria-label="Pengaturan" title="Pengaturan" nativeButton={false} render={<Link href="/pengaturan" />}>
          <Settings className="size-[18px]" />
        </Button>
        <ProfileMenu
          employeeId={ctx.employee.id}
          name={ctx.employee.full_name}
          role={ctx.roles.map((r) => r.name).join(", ")}
          branch={ctx.branch.name}
          photoUrl={ctx.employee.photo_url}
          logout={logoutAction}
        />
      </div>
    </>
  );
}

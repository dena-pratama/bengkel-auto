import { Bell, LogOut, Search, Settings, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconNav, MobileNav } from "@/components/app-nav";
import { can, type UserContext } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/navigation";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Kerangka halaman: pita biru dengan navigasi ikon (md ke atas) + top bar.
 * HP: pita disembunyikan, menu lewat sheet.
 */
export function AppShell({
  rail,
  topbar,
  children,
}: {
  rail: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <aside className="sticky top-0 hidden h-svh w-[88px] shrink-0 flex-col items-center gap-6 rounded-r-[36px] bg-brand-blue-ink py-5 md:flex">
        {rail}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/70 bg-background/85 px-3 backdrop-blur sm:px-6">
          {topbar}
        </header>
        <main className="min-w-0 flex-1 px-3 pt-4 pb-8 sm:px-6">{children}</main>
      </div>
    </div>
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

export function RailView({ ctx }: { ctx: UserContext }) {
  return (
    <>
      <span className="flex size-11 items-center justify-center rounded-xl bg-brand-red text-white shadow-lg shadow-black/15" title="Bengkel Mobil App">
        <Wrench className="size-5" />
      </span>
      {/* Tanpa overflow agar tooltip label tidak terpotong */}
      <div className="flex-1">
        <IconNav items={visibleNavItems(ctx)} />
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex size-11 items-center justify-center rounded-xl text-white/80 hover:bg-white/12 hover:text-white"
          aria-label="Keluar"
          title="Keluar"
        >
          <LogOut className="size-5" />
        </button>
      </form>
    </>
  );
}

export function RailSkeleton() {
  return <div className="h-80 w-11 animate-pulse rounded-xl bg-white/10" />;
}

export function TopbarView({ ctx }: { ctx: UserContext }) {
  return (
    <>
      <MobileNav items={visibleNavItems(ctx)} />
      <div className="min-w-0 md:hidden">
        <p className="truncate text-sm font-semibold">{ctx.branch.name}</p>
      </div>

      <label className="ml-auto hidden h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-border bg-card px-3 sm:flex md:ml-0">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          placeholder="Cari no. polisi, WO, barang…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi" title="Notifikasi">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-brand-red ring-2 ring-background" />
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Pengaturan" title="Pengaturan (segera)">
          <Settings className="size-5" />
        </Button>
        <div className="ml-1 flex items-center gap-2.5 rounded-xl border border-border bg-card py-1 pr-3 pl-1">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-blue-soft text-xs font-semibold text-brand-blue-ink">
            {initials(ctx.employee.full_name)}
          </span>
          <div className="hidden leading-tight lg:block">
            <p className="text-sm font-medium">{ctx.employee.full_name}</p>
            <p className="text-[11px] text-muted-foreground">{ctx.roles.map((r) => r.name).join(", ")}</p>
          </div>
        </div>
        <form action={logoutAction} className="md:hidden">
          <Button type="submit" variant="ghost" size="icon" aria-label="Keluar">
            <LogOut className="size-5" />
          </Button>
        </form>
      </div>
    </>
  );
}

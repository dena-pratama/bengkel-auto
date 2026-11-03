import { Bell, LogOut, Search, Settings, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideNav, SidebarClose, SidebarFrame, SidebarToggle } from "@/components/app-nav";
import { can, type UserContext } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/navigation";
import { logoutAction } from "@/app/(auth)/actions";

/**
 * Kerangka halaman: sidebar melayang (bisa tampil/sembunyi) + top bar.
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

export function RailView({ ctx }: { ctx: UserContext }) {
  return (
    <>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white shadow-lg shadow-black/15">
          <Wrench className="size-5" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">Bengkel Mobil</p>
          <p className="truncate text-[11px] text-white/65">{ctx.branch.name}</p>
        </div>
        <SidebarClose />
      </div>

      <p className="px-5 pt-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">Menu</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin] [scrollbar-color:rgb(255_255_255/0.2)_transparent]">
        <SideNav items={visibleNavItems(ctx)} />
      </div>

      <div className="m-3 flex items-center gap-2.5 rounded-2xl bg-white/10 p-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-semibold text-brand-blue-ink">
          {initials(ctx.employee.full_name)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{ctx.employee.full_name}</p>
          <p className="truncate text-[11px] text-white/65">{ctx.roles.map((r) => r.name).join(", ")}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex size-9 items-center justify-center rounded-xl text-white/80 hover:bg-brand-red hover:text-white"
            aria-label="Keluar"
            title="Keluar"
          >
            <LogOut className="size-[18px]" />
          </button>
        </form>
      </div>
    </>
  );
}

export function RailSkeleton() {
  return <div className="m-4 h-80 animate-pulse rounded-2xl bg-white/10" />;
}

export function TopbarView({ ctx }: { ctx: UserContext }) {
  return (
    <>
      <SidebarToggle />
      <div className="min-w-0 sm:hidden">
        <p className="truncate text-sm font-semibold">{ctx.branch.name}</p>
      </div>

      <label className="hidden h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-border bg-card px-3 sm:flex">
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
      </div>
    </>
  );
}

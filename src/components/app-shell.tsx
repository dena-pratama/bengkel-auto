import Image from "next/image";
import { Bell, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SideNav, SidebarFrame, SidebarRailToggle, SidebarToggle } from "@/components/app-nav";
import { ProfileMenu, ThemeToggle } from "@/components/topbar-controls";
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
      <div className="grid gap-2 px-3 pt-3 pb-2 group-data-[collapsed=true]/sb:justify-items-center">
        {/* Bentang: logo lengkap AutoMobi; ciut: ikon saja (tidak cukup ruang untuk tulisan) */}
        <span className="flex h-16 items-center justify-center rounded-[24px] bg-white px-4 shadow-sm group-data-[collapsed=true]/sb:hidden">
          <Image src="/brand/automobi-logo.png" alt="AutoMobi" width={671} height={335} className="h-12 w-auto" priority />
        </span>
        <span className="hidden size-12 items-center justify-center rounded-full bg-white p-1.5 shadow-sm group-data-[collapsed=true]/sb:flex">
          <Image src="/brand/automobi-mark.png" alt="AutoMobi" width={64} height={64} className="size-full object-contain" priority />
        </span>
        <div className="flex items-center gap-2 pl-2 group-data-[collapsed=true]/sb:pl-0">
          <p className="min-w-0 flex-1 truncate text-xs text-white/70 group-data-[collapsed=true]/sb:hidden">{ctx.branch.name}</p>
          <SidebarRailToggle />
        </div>
      </div>

      <p className="px-5 pt-2 pb-2 group-data-[collapsed=true]/sb:hidden text-2xs font-semibold tracking-[0.14em] text-white/50 uppercase">Menu</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [scrollbar-width:thin] [scrollbar-color:rgb(255_255_255/0.2)_transparent] group-data-[collapsed=true]/sb:overflow-visible">
        <SideNav items={visibleNavItems(ctx)} />
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

      <label className="hidden h-10 w-full max-w-sm items-center gap-2 rounded-full bg-card px-4 shadow-sm sm:flex">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          placeholder="Cari no. polisi, WO, barang…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifikasi" title="Notifikasi">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-brand-red ring-2 ring-background" />
        </Button>
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Pengaturan" title="Pengaturan (segera)">
          <Settings className="size-5" />
        </Button>
        <ProfileMenu
          employeeId={ctx.employee.id}
          name={ctx.employee.full_name}
          role={ctx.roles.map((r) => r.name).join(", ")}
          branch={ctx.branch.name}
          initials={initials(ctx.employee.full_name)}
          logout={logoutAction}
        />
      </div>
    </>
  );
}

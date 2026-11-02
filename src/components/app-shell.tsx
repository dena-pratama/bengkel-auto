import { CalendarDays, ChevronDown, LogOut, Plus, QrCode, ReceiptText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav, NavLinks } from "@/components/app-nav";
import { can, type UserContext } from "@/lib/auth";
import { serviceToday } from "@/lib/demo/dashboard";
import { NAV_ITEMS } from "@/lib/navigation";
import { logoutAction } from "@/app/(auth)/actions";

const panel = "rounded-2xl border border-border bg-card p-3";

/** Kerangka halaman: sidebar kartu (desktop) + header ringkas (HP). */
export function AppShell({
  sidebar,
  mobileHeader,
  children,
}: {
  sidebar: React.ReactNode;
  mobileHeader: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-3 overflow-y-auto p-4 pr-0 [scrollbar-width:none] md:flex">
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-card px-3 md:hidden">
          {mobileHeader}
        </header>
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return <div className={`${panel} h-[460px] animate-pulse`} />;
}

export function visibleNavItems(ctx: UserContext) {
  return NAV_ITEMS.filter((item) => !item.module || can(ctx, item.module, item.action ?? "view"));
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function LogoutButton({ size = "icon-sm" }: { size?: "icon-sm" | "icon" }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size={size} aria-label="Keluar" title="Keluar">
        <LogOut className="size-4" />
      </Button>
    </form>
  );
}

export function SidebarView({ ctx }: { ctx: UserContext }) {
  const canService = can(ctx, "service_orders");
  const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );

  return (
    <>
      <div className={`${panel} flex items-center gap-3`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-blue-soft text-sm font-semibold text-brand-blue-ink">
          {initials(ctx.employee.full_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Selamat datang,</p>
          <p className="truncate text-sm font-semibold">{ctx.employee.full_name}</p>
        </div>
        <LogoutButton />
      </div>

      <div className={`${panel} flex items-center gap-3`}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-sand-soft text-[11px] font-semibold text-[#6b5d33]">
          {ctx.branch.code}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">Cabang</p>
          <p className="truncate text-sm font-medium">{ctx.branch.name}</p>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </div>

      <div className={panel}>
        <NavLinks items={visibleNavItems(ctx)} />
      </div>

      {canService && (
        <>
          <div className="rounded-2xl bg-brand-red p-4 text-white shadow-lg shadow-brand-red/25">
            <div className="flex items-start justify-between">
              <p className="text-lg font-medium leading-tight">
                Servis
                <br />
                hari ini
              </p>
              <span className="text-xs text-white/80">{today}</span>
            </div>
            <div className="mt-3 flex gap-1 text-xs">
              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-brand-red">Masuk</span>
              <span className="rounded-full px-2 py-1 text-white/85">Selesai</span>
              <span className="rounded-full px-2 py-1 text-white/85">Diambil</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-2">
              <p className="text-[11px] text-white/80">
                {serviceToday.selesai} selesai · {serviceToday.diambil} diambil
              </p>
              <p className="text-3xl font-semibold leading-none">{serviceToday.masuk}</p>
            </div>
          </div>

          <div className={`${panel} flex justify-around py-2`}>
            {[
              { icon: CalendarDays, label: "Booking" },
              { icon: QrCode, label: "Scan QR" },
              { icon: ReceiptText, label: "Nota" },
              { icon: Wrench, label: "Papan servis" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                title={`${label} (segera)`}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground"
              >
                <Icon className="size-4" />
                <span className="sr-only">{label}</span>
              </span>
            ))}
          </div>

          <div
            title="Tersedia setelah modul Servis"
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-red/40 bg-card px-3 py-5 text-center"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-red text-white shadow-md shadow-brand-red/30">
              <Plus className="size-5" />
            </span>
            <span className="text-sm font-medium">Buat Work Order baru</span>
          </div>
        </>
      )}
    </>
  );
}

export function MobileHeaderView({ ctx }: { ctx: UserContext }) {
  return (
    <>
      <MobileNav items={visibleNavItems(ctx)} />
      <span className="flex size-7 items-center justify-center rounded-md bg-brand-red text-white">
        <Wrench className="size-4" />
      </span>
      <span className="flex-1 truncate text-sm font-semibold">{ctx.branch.name}</span>
      <LogoutButton size="icon" />
    </>
  );
}

import { BarChart3, LayoutGrid, Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { can, type UserContext } from "@/lib/auth";
import type { Customer } from "@/lib/customers";
import type { DashboardData } from "@/lib/dashboard";
import { addDays, todayWib } from "@/lib/format";
import type { CatalogOption, VehicleOption } from "@/lib/service";
import { cn } from "@/lib/utils";
import { NewWorkOrderButton, QuickActions } from "./_components/quick-actions";
import { ActiveWorkOrders, Hero, LowStockPanel, MechanicLoad, NotificationsPanel, ShiftPanel, StatTiles } from "./widgets";

const TABS = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Papan servis", icon: Workflow, href: "/servis" },
  { label: "Laporan", icon: BarChart3, href: "/keuangan/laporan" },
];

// Tautan aksi cepat yang boleh dipakai peran ini
const ACTION_MODULE: Record<string, [string, "view" | "create"]> = {
  "/servis/estimasi": ["service_orders", "view"],
  "/servis": ["service_orders", "view"],
  "/kasir": ["sales", "view"],
  "/inventory/scan": ["master_data", "view"],
};

export function DashboardView({
  ctx,
  data,
  vehicles = [],
  catalog = [],
  customers = [],
  models = [],
}: {
  ctx: UserContext;
  data: DashboardData;
  vehicles?: VehicleOption[];
  catalog?: CatalogOption[];
  customers?: Pick<Customer, "id" | "name" | "phone" | "is_active">[];
  models?: { make: string; model: string }[];
}) {
  const firstName = ctx.employee.full_name.split(" ")[0];
  const allowed = (href: string) => {
    const rule = ACTION_MODULE[href];
    return !rule || can(ctx, rule[0], rule[1]);
  };
  const tabs = TABS.filter((t) => !t.href || allowed(t.href));
  const hasBody = data.workOrders || data.notifications || data.lowStock || data.shift !== undefined;
  const validUntil = addDays(todayWib(), 7);
  const canCreateWO = can(ctx, "service_orders", "create");
  const canCreateVehicle = can(ctx, "customers", "create");
  const canCreateSale = can(ctx, "sales", "create");
  const canViewStock = can(ctx, "master_data", "view");

  return (
    <div className="mx-auto grid max-w-[1440px] gap-5">
      {/* Tab halaman + aksi */}
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 [scrollbar-width:none]">
          {tabs.map(({ label, icon: Icon, active, href }) => {
            const cls = cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-brand-rail text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            );
            return active || !href ? (
              <span key={label} className={cls}>
                <Icon className="size-4" />
                {label}
              </span>
            ) : (
              <Link key={label} href={href} className={cls}>
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        {data.sample && <span className="rounded-full bg-brand-sand-soft px-2.5 py-1 text-2xs font-medium text-brand-sand">Data contoh</span>}
        {canCreateWO ? (
          <NewWorkOrderButton
            vehicles={vehicles}
            catalog={catalog}
            validUntil={validUntil}
          />
        ) : allowed("/servis/estimasi") ? (
          <Link href="/servis/estimasi" className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" >
            <Plus className="size-4" /> Work order
          </Link>
        ) : null}
      </div>

      <Hero firstName={firstName} />
      <QuickActions
        canCreateWO={canCreateWO}
        canCreateVehicle={canCreateVehicle}
        canCreateSale={canCreateSale}
        canViewStock={canViewStock}
        vehicles={vehicles}
        catalog={catalog}
        customers={customers}
        models={models}
        shiftOpen={Boolean(data.shift)}
        validUntil={validUntil}
      />
      <StatTiles data={data} />

      {hasBody ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {data.workOrders && <ActiveWorkOrders data={data.workOrders} />}
          {data.notifications && <NotificationsPanel data={data.notifications} />}
          {data.workOrders && <MechanicLoad rows={data.workOrders.mechanicLoad} active={data.workOrders.active} />}
          {data.lowStock && <LowStockPanel data={data.lowStock} />}
          {data.shift !== undefined && <ShiftPanel shift={data.shift} />}
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Pilih menu untuk mulai bekerja.</p>
        </section>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-4">
      <div className="h-10 w-72 animate-pulse rounded-xl bg-muted" />
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-xl bg-muted xl:col-span-2" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

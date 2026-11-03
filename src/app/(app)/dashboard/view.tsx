import { Download, LayoutGrid, Plus, Workflow, BarChart3 } from "lucide-react";
import { can, type UserContext } from "@/lib/auth";
import { DEMO } from "@/lib/demo/dashboard";
import { cn } from "@/lib/utils";
import {
  AgendaCard,
  CashShiftCard,
  Hero,
  LowStockCard,
  MechanicJobCard,
  NotificationsCard,
  QuickTiles,
  TargetsCards,
  TodayWorkOrdersCard,
  card,
} from "./widgets";

const TABS = [
  { label: "Dashboard", icon: LayoutGrid, active: true },
  { label: "Papan servis", icon: Workflow },
  { label: "Laporan", icon: BarChart3 },
];

export function DashboardView({ ctx }: { ctx: UserContext }) {
  const firstName = ctx.employee.full_name.split(" ")[0];
  const showOps = can(ctx, "dashboard") || can(ctx, "service_orders");
  const showFinance = can(ctx, "finance_reports");

  return (
    <div className="mx-auto grid max-w-[1440px] gap-5">
      {/* Tab halaman + aksi */}
      <div className="flex flex-wrap items-center gap-2">
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {TABS.map(({ label, icon: Icon, active }) => (
            <span
              key={label}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
              title={active ? undefined : `${label} (segera)`}
            >
              <Icon className="size-4" />
              {label}
            </span>
          ))}
        </nav>
        {DEMO && (
          <span className="rounded-full bg-brand-red-soft px-2.5 py-1 text-2xs font-medium text-brand-red">Data contoh</span>
        )}
        <div className="ml-auto flex gap-2">
          {showFinance && (
            <span className="hidden items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-2 text-sm font-medium sm:flex" title="Segera">
              <Download className="size-4" /> Ekspor
              <span className="rounded-md bg-brand-blue-soft px-1.5 py-0.5 text-2xs text-brand-blue-fg">xlsx</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-sm bg-brand-blue-ink px-4 py-2 text-sm font-medium text-white shadow-md shadow-brand-blue-ink/25" title="Tersedia setelah modul Servis">
            <Plus className="size-4" /> Work order
          </span>
        </div>
      </div>

      {showOps ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <Hero firstName={firstName} />
          <QuickTiles />

          <NotificationsCard />
          <MechanicJobCard />
          <AgendaCard />

          <TodayWorkOrdersCard />
          <LowStockCard />
          <div className="grid grid-cols-2 content-start gap-4 xl:col-span-4">
            {showFinance && <TargetsCards />}
            <CashShiftCard />
          </div>
        </div>
      ) : (
        <>
          <Hero firstName={firstName} />
          <section className={card}>
            <p className="text-sm text-muted-foreground">Pilih menu untuk mulai bekerja.</p>
          </section>
        </>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-4 md:grid-cols-2 xl:grid-cols-12">
      <div className="h-40 animate-pulse rounded-md bg-card/70 md:col-span-2 xl:col-span-5" />
      <div className="h-40 animate-pulse rounded-md bg-card/70 md:col-span-2 xl:col-span-7" />
      {[4, 4, 4].map((s, i) => (
        <div key={i} className="h-64 animate-pulse rounded-md bg-card/70 xl:col-span-4" />
      ))}
    </div>
  );
}

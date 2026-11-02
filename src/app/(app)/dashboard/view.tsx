import { ChevronDown, Search } from "lucide-react";
import { can, type UserContext } from "@/lib/auth";
import { DEMO } from "@/lib/demo/dashboard";
import {
  BayCapacityCard,
  HealthScoreCard,
  RemindersCard,
  RevenueTrendCard,
  ServiceFlowCard,
  WorkOrderCard,
  card,
} from "./widgets";

export function DashboardView({ ctx }: { ctx: UserContext }) {
  const showOps = can(ctx, "dashboard") || can(ctx, "service_orders");
  const showFinance = can(ctx, "finance_reports");
  const showAi = can(ctx, "ai_analyst");

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <span className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
          Hari ini <ChevronDown className="size-3.5" />
        </span>
        {DEMO && (
          <span className="rounded-full bg-brand-sand-soft px-2.5 py-1 text-[11px] font-medium text-[#6b5d33]">
            Data contoh
          </span>
        )}
        <label className="ml-auto flex w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:w-64">
          <Search className="size-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Cari no. polisi, WO, barang"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </header>

      {showOps ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ServiceFlowCard />
          <WorkOrderCard />
          <BayCapacityCard />
          {showFinance && <RevenueTrendCard />}
          {showAi && <HealthScoreCard />}
          <RemindersCard />
        </div>
      ) : (
        <section className={card}>
          <h2 className="text-base font-semibold">Selamat bekerja, {ctx.employee.full_name.split(" ")[0]}</h2>
          <p className="text-sm text-muted-foreground">Pilih menu di samping untuk mulai.</p>
        </section>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1400px] gap-4">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-brand-sand-soft" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl border bg-card lg:col-span-3" />
        <div className="h-60 animate-pulse rounded-2xl border bg-card lg:col-span-2" />
        <div className="h-60 animate-pulse rounded-2xl border bg-card" />
      </div>
    </div>
  );
}

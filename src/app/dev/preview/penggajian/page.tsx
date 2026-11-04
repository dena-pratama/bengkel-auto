import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  Wallet,
} from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { PayrollPeriod } from "@/lib/payroll";
import { formatDate, formatRupiah } from "@/lib/format";
import { PayrollStatusBadge } from "@/app/(app)/penggajian/_components/ui";
import { cn } from "@/lib/utils";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama HR", position: "HR & Payroll", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "HR Admin" }],
  permissions: [],
};

const SAMPLE_PERIODS: PayrollPeriod[] = [
  {
    id: "pay-1",
    period_no: "PR-2611-0001",
    label: "Gaji November 2026",
    period_type: "monthly",
    start_date: "2026-11-01",
    end_date: "2026-11-30",
    status: "review",
    approved_at: null,
    paid_date: null,
    void_reason: null,
    slips: 6,
    gross: 28500000,
    net: 27150000,
  },
  {
    id: "pay-2",
    period_no: "PR-2610-0001",
    label: "Gaji Oktober 2026",
    period_type: "monthly",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    status: "paid",
    approved_at: "2026-11-01T08:00:00Z",
    paid_date: "2026-11-05",
    void_reason: null,
    slips: 6,
    gross: 25200000,
    net: 23850000,
  },
  {
    id: "pay-3",
    period_no: "PR-2609-0001",
    label: "Gaji September 2026",
    period_type: "monthly",
    start_date: "2026-09-01",
    end_date: "2026-09-30",
    status: "paid",
    approved_at: "2026-10-01T08:00:00Z",
    paid_date: "2026-10-05",
    void_reason: null,
    slips: 6,
    gross: 25400000,
    net: 24120000,
  },
  {
    id: "pay-4",
    period_no: "PR-2608-0001",
    label: "Gaji Agustus 2026",
    period_type: "monthly",
    start_date: "2026-08-01",
    end_date: "2026-08-31",
    status: "paid",
    approved_at: "2026-09-01T08:00:00Z",
    paid_date: "2026-09-05",
    void_reason: null,
    slips: 5,
    gross: 22800000,
    net: 21400000,
  },
];

export default function PayrollPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau penggajian...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  const openPeriods = SAMPLE_PERIODS.filter((p) => p.status === "draft" || p.status === "review" || p.status === "approved");
  const paidPeriods = SAMPLE_PERIODS.filter((p) => p.status === "paid");
  const totalPaid = paidPeriods.reduce((sum, p) => sum + p.net, 0);
  const pendingTotal = openPeriods.reduce((sum, p) => sum + p.net, 0);
  const latestPeriod = SAMPLE_PERIODS[0] ?? null;
  const avgPaid = paidPeriods.length > 0 ? Math.round(totalPaid / paidPeriods.length) : 0;

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <PageHeader
          title="Penggajian"
          description="Tahun 2026 · 4 periode · 1 belum dibayar"
          actions={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-rail px-4 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
            >
              <Plus className="size-4" />
              Periode gaji
            </button>
          }
        />

        {/* 4 Summary Stat Cards matching Figma */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <Wallet className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total periode terkini</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
                {latestPeriod ? formatRupiah(latestPeriod.net) : "Rp 0"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {latestPeriod ? `${latestPeriod.slips} karyawan · ${latestPeriod.label}` : "Belum ada periode"}
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <Clock className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Menunggu dibayar</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
                {openPeriods.length} periode
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {openPeriods.length > 0 ? `${formatRupiah(pendingTotal)} · perlu diproses` : "Semua dibayar"}
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <CheckCircle2 className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sudah dibayar tahun ini</p>
              <p className="text-lg font-semibold leading-tight tabular-nums text-brand-green sm:text-xl">
                {formatRupiah(totalPaid)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {paidPeriods.length} dari {SAMPLE_PERIODS.length} periode
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted">
              <Banknote className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Rata-rata per periode</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">
                {formatRupiah(avgPaid)}
              </p>
              <p className="text-[11px] text-muted-foreground">akumulasi periode lunas</p>
            </div>
          </div>
        </section>

        {/* Table Card */}
        <section className={cn(panel, "overflow-hidden p-4 sm:p-5")}>
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pt-1">Periode</th>
                  <th className="pb-3 pt-1">Jenis</th>
                  <th className="pb-3 pt-1">Karyawan</th>
                  <th className="pb-3 pt-1 text-right">Total Gaji</th>
                  <th className="pb-3 pt-1">Dibayar</th>
                  <th className="pb-3 pt-1">Status</th>
                  <th className="pb-3 pt-1 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SAMPLE_PERIODS.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-muted/40">
                    <td className="py-3.5 pr-3">
                      <p className="font-semibold text-foreground">{p.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.period_no} · {formatDate(p.start_date)} s/d {formatDate(p.end_date)}
                      </p>
                    </td>
                    <td className="py-3.5 pr-3 text-xs text-muted-foreground">
                      {p.period_type === "monthly" ? "Bulanan" : "Mingguan"}
                    </td>
                    <td className="py-3.5 pr-3 text-xs">
                      <span className="font-medium text-foreground">{p.slips}</span> orang
                    </td>
                    <td className="py-3.5 pr-3 text-right">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatRupiah(p.net)}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3 text-xs text-muted-foreground">
                      {p.paid_date ? formatDate(p.paid_date) : "-"}
                    </td>
                    <td className="py-3.5 pr-3">
                      <PayrollStatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 text-right">
                      <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                        <ChevronRight className="size-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

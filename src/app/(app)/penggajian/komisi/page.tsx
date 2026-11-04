import { Suspense } from "react";
import { Medal } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { formatDate, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { listActiveEmployees, listCommissions } from "@/lib/payroll";
import { COMMISSION_LABEL } from "@/lib/validation/payroll";
import { cn } from "@/lib/utils";
import { PayrollNav } from "../_components/ui";

export default function CommissionsPage({ searchParams }: PageProps<"/penggajian/komisi">) {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  const all = can(ctx, "payroll", "view", false) || can(ctx, "commissions", "view", false);
  if (!all && !can(ctx, "commissions", "view") && !can(ctx, "payroll", "view")) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "bulan-ini");
  const statuses = Object.keys(COMMISSION_LABEL) as (keyof typeof COMMISSION_LABEL)[];
  const status = readOption(sp, "status", statuses);
  const employees = can(ctx, "payroll", "view", false) ? await listActiveEmployees() : [];
  const employee = employees.length ? readOption(sp, "karyawan", employees.map((e) => e.id)) : null;
  const rows = await listCommissions({ from: range.from, to: range.to, status, employee });
  const sum = (st: string) => rows.filter((r) => r.status === st).reduce((t, r) => t + r.amount, 0);

  return (
    <>
      <PayrollNav active="commissions" showAll={can(ctx, "payroll", "view", false)} />
      <PageHeader title={all ? "Komisi mekanik" : "Komisi saya"} description={`${describeRange(range, formatDate)} · ${rows.length} komisi. Diakui setelah invoice lunas dan dibayar bersama gaji.`} />
      <ListFilter
        today={today}
        range={range}
        defaultRange="bulan-ini"
        dateLabel="Tanggal komisi"
        selects={[
          { name: "status", label: "Status", value: status, options: statuses.map((v) => ({ value: v, label: COMMISSION_LABEL[v] })), allLabel: "Semua status" },
          ...(employees.length ? [{ name: "karyawan", label: "Mekanik", value: employee, options: employees.map((e) => ({ value: e.id, label: e.full_name })), allLabel: "Semua mekanik" }] : []),
        ]}
      />
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Menunggu invoice lunas", sum("pending")],
          ["Diakui, belum dibayar", sum("recognized")],
          ["Sudah dibayar", sum("paid")],
        ].map(([label, v]) => (
          <div key={label as string} className={cn(panel, "grid gap-1")}>
            <p className="text-sm text-muted-foreground">{label as string}</p>
            <p className="text-2xl font-bold tabular-nums">{formatRupiah(v as number)}</p>
          </div>
        ))}
      </section>
      <section className={cn(panel, "p-4 sm:p-5")}>
        {rows.length === 0 ? (
          <EmptyState icon={Medal} text="Belum ada komisi. Komisi tercatat saat invoice servis diterbitkan." />
        ) : (
          <ul className="grid divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-3", r.status === "void" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {all && r.employee_name ? `${r.employee_name} · ` : ""}
                    {r.sale_no ?? "Invoice"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(r.created_at)} · dasar {formatRupiah(r.base_amount)} · {r.commission_type === "percent" ? `${formatQty(r.commission_value)}%` : `${formatRupiah(r.commission_value)} tetap`} · porsi {formatQty(r.share_percent)}%
                  </p>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", r.status === "paid" ? "bg-brand-rail text-white" : r.status === "recognized" ? "bg-brand-blue-soft text-brand-blue-fg" : "bg-muted")}>
                  {COMMISSION_LABEL[r.status]}
                </span>
                <span className="w-28 text-right font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

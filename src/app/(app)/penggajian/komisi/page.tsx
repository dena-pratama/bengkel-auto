import { Suspense } from "react";
import { Medal } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { listCommissions } from "@/lib/payroll";
import { COMMISSION_LABEL } from "@/lib/validation/payroll";
import { cn } from "@/lib/utils";
import { PayrollNav } from "../_components/ui";

export default function CommissionsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  const all = can(ctx, "payroll", "view", false) || can(ctx, "commissions", "view", false);
  if (!all && !can(ctx, "commissions", "view") && !can(ctx, "payroll", "view")) return <NoAccess />;
  const rows = await listCommissions();
  const sum = (st: string) => rows.filter((r) => r.status === st).reduce((t, r) => t + r.amount, 0);

  return (
    <>
      <PayrollNav active="commissions" showAll={can(ctx, "payroll", "view", false)} />
      <PageHeader title={all ? "Komisi mekanik" : "Komisi saya"} description="Komisi diakui setelah invoice lunas dan dibayar bersama gaji." />
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

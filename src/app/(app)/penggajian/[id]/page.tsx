import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { getPayrollPeriod, listCashAccounts } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import { PeriodActions, SlipEditor } from "../_components/forms";
import { PayrollStatusBadge, UUID } from "../_components/ui";

export default function PeriodPage({ params }: PageProps<"/penggajian/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "payroll", "view")) return <NoAccess />;
  const all = can(ctx, "payroll", "view", false);
  const period = await getPayrollPeriod(id);
  if (!period) notFound();
  const canUpdate = can(ctx, "payroll", "update", false);
  const draft = period.status === "draft" && canUpdate;
  const cash = canUpdate && period.status === "approved" ? await listCashAccounts() : [];
  const net = period.slips.reduce((t, s) => t + s.net_amount, 0);
  const gross = period.slips.reduce((t, s) => t + s.gross_amount, 0);

  return (
    <>
      <PageHeader title={period.label} description={`${period.period_no} · ${formatDate(period.start_date)} s/d ${formatDate(period.end_date)}`} back={{ href: "/penggajian", label: "Penggajian" }} />

      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <PayrollStatusBadge status={period.status} />
          {period.paid_date && (
            <span className="text-muted-foreground">
              Dibayar {formatDate(period.paid_date)}
              {period.cash_bank_accounts && ` dari ${period.cash_bank_accounts.name}`}
            </span>
          )}
          {period.void_reason && <span className="text-brand-red">Alasan batal: {period.void_reason}</span>}
        </div>
        {all && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Karyawan</dt>
                <dd className="text-lg font-semibold">{period.slips.length}</dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Gaji kotor</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatRupiah(gross)}</dd>
              </div>
              <div className="rounded-2xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">Gaji bersih dibayar</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatRupiah(net)}</dd>
              </div>
            </dl>
            <PeriodActions
              id={period.id}
              status={period.status}
              net={net}
              canUpdate={canUpdate}
              canApprove={can(ctx, "payroll", "approve", false)}
              canVoid={can(ctx, "payroll", "void", false)}
              cashAccounts={cash}
              today={todayWib()}
            />
          </>
        )}
      </section>

      <ul className="grid gap-4">
        {period.slips.map((s) => (
          <li key={s.id} className={cn(panel, "grid gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{s.employee_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.slip_no} · {s.employee_position ?? "Tanpa jabatan"} · {s.pay_type === "daily" ? `harian ${formatRupiah(s.base_salary)}/hari` : `bulanan ${formatRupiah(s.base_salary)}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold tabular-nums">{formatRupiah(s.net_amount)}</span>
                <Link href={`/penggajian/slip/${s.id}`} className="flex items-center gap-1 text-sm font-medium text-brand-blue-fg hover:underline">
                  <FileText className="size-4" /> Slip
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tabular-nums sm:grid-cols-4">
              <Item label={s.pay_type === "daily" ? `Gaji pokok (${formatQty(s.days_worked)} hari)` : "Gaji pokok"} value={s.base_amount} />
              <Item label="Tunjangan" value={s.allowance_amount} />
              <Item label={`Lembur (${formatQty(s.overtime_hours)} jam)`} value={s.overtime_amount} />
              <Item label="Komisi" value={s.commission_amount} />
              <Item label="Bonus" value={s.bonus_amount} />
              <Item label="Potongan kasbon" value={-s.loan_deduction} />
              <Item label={`Potongan lain${s.other_deduction_note ? ` (${s.other_deduction_note})` : ""}`} value={-s.other_deduction} />
              <Item label="Gaji kotor" value={s.gross_amount} bold />
            </dl>
            {draft && <SlipEditor slip={s} />}
          </li>
        ))}
      </ul>
    </>
  );
}

function Item({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn(bold && "font-semibold", value < 0 && "text-brand-red")}>{formatRupiah(value)}</dd>
    </div>
  );
}

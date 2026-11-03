import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { getPayslip } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import { PrintButton } from "../../../kasir/_components/print-button";
import { PayrollStatusBadge, UUID } from "../../_components/ui";

export default function SlipPage({ params }: PageProps<"/penggajian/slip/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
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
  const s = await getPayslip(id);
  if (!s) notFound();

  const rows: { label: string; value: number; note?: string }[] = [
    { label: s.pay_type === "daily" ? `Gaji pokok (${formatQty(s.days_worked)} hari x ${formatRupiah(s.base_salary)})` : "Gaji pokok", value: s.base_amount },
    ...s.allowance_details.map((a) => ({ label: `Tunjangan ${a.name}`, value: a.amount })),
    ...(s.overtime_amount > 0 ? [{ label: `Lembur (${formatQty(s.overtime_hours)} jam x ${formatRupiah(s.overtime_rate)})`, value: s.overtime_amount }] : []),
    ...(s.commission_amount > 0 ? [{ label: "Komisi", value: s.commission_amount }] : []),
    ...(s.bonus_amount > 0 ? [{ label: "Bonus", value: s.bonus_amount }] : []),
  ];
  const deductions: { label: string; value: number }[] = [
    ...(s.loan_deduction > 0 ? [{ label: "Potongan kasbon", value: s.loan_deduction }] : []),
    ...(s.other_deduction > 0 ? [{ label: `Potongan lain${s.other_deduction_note ? ` (${s.other_deduction_note})` : ""}`, value: s.other_deduction }] : []),
  ];

  return (
    <>
      <PageHeader title={`Slip gaji ${s.employee_name}`} description={`${s.slip_no} · ${s.period_label}`} back={{ href: `/penggajian/${s.period_id}`, label: "Periode gaji" }} actions={<PrintButton />} />
      <section className={cn(panel, "grid gap-4 sm:p-8")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xl font-semibold">{s.employee_name}</p>
            <p className="text-sm text-muted-foreground">{s.employee_position ?? "Tanpa jabatan"}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{s.period_label}</p>
            <p className="text-muted-foreground">
              {formatDate(s.start_date)} s/d {formatDate(s.end_date)}
            </p>
            <div className="mt-1 flex justify-end print:hidden">
              <PayrollStatusBadge status={s.period_status} />
            </div>
          </div>
        </div>

        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td colSpan={2} className="pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Penghasilan
              </td>
            </tr>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-2">{r.label}</td>
                <td className="py-2 text-right tabular-nums">{formatRupiah(r.value)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-semibold">Gaji kotor</td>
              <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(s.gross_amount)}</td>
            </tr>
            {deductions.length > 0 && (
              <>
                <tr>
                  <td colSpan={2} className="pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Potongan
                  </td>
                </tr>
                {deductions.map((d, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2">{d.label}</td>
                    <td className="py-2 text-right tabular-nums">-{formatRupiah(d.value)}</td>
                  </tr>
                ))}
              </>
            )}
            <tr className="bg-muted/60">
              <td className="px-2 py-3 text-base font-bold">Gaji bersih diterima</td>
              <td className="px-2 py-3 text-right text-xl font-bold tabular-nums">{formatRupiah(s.net_amount)}</td>
            </tr>
          </tbody>
        </table>

        {s.commissions.length > 0 && (
          <div className="grid gap-1">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rincian komisi</p>
            <ul className="grid divide-y divide-border/60 text-sm">
              {s.commissions.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {c.sales?.sale_no ?? "Invoice"} <span className="text-xs text-muted-foreground">· dasar {formatRupiah(c.base_amount)}</span>
                  </span>
                  <span className="tabular-nums">{formatRupiah(c.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.notes && <p className="text-sm text-muted-foreground">Catatan: {s.notes}</p>}
        {s.paid_date && <p className="text-xs text-muted-foreground">Dibayar {formatDate(s.paid_date)}</p>}
      </section>
    </>
  );
}

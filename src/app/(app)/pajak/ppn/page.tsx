import { Suspense } from "react";
import { Download } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { getPpnDocuments, getPpnSummary, getTaxSettings, listCashAccounts, listTaxPayments } from "@/lib/tax";
import { cn } from "@/lib/utils";
import { monthRange } from "../../keuangan/_components/ui";
import { PayTaxDialog, VoidTaxPaymentButton } from "../_components/forms";
import { DATE, TaxNav } from "../_components/ui";

export default function PpnPage({ searchParams }: PageProps<"/pajak/ppn">) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5">
      <TaxNav active="ppn" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const KIND_LABEL = { keluaran: "Keluaran", retur_keluaran: "Retur (Keluaran)", masukan: "Masukan" } as const;

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "tax_settings", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const month = monthRange(today);
  const from = DATE.test(pick(sp.dari) ?? "") ? pick(sp.dari)! : month.from;
  const to = DATE.test(pick(sp.sampai) ?? "") && pick(sp.sampai)! >= from ? pick(sp.sampai)! : month.to;
  const [settings, summary, docs, payments, cash] = await Promise.all([
    getTaxSettings(),
    getPpnSummary(from, to),
    getPpnDocuments(from, to),
    listTaxPayments("ppn"),
    listCashAccounts(),
  ]);
  const canPay = can(ctx, "tax_settings", "create", false);
  const dpp = (k: string) => docs.filter((d) => d.kind === k).reduce((t, d) => t + d.dpp, 0);

  return (
    <>
      <PageHeader
        title="Laporan PPN"
        description={`${formatDate(from)} s/d ${formatDate(to)}`}
        actions={
          <Button variant="outline" nativeButton={false} render={<a href={`/api/v1/keuangan/export?jenis=ppn&dari=${from}&sampai=${to}`} />}>
            <Download className="size-4" /> Ekspor Excel
          </Button>
        }
      />
      {!settings.ppn_enabled && (
        <p className="rounded-2xl bg-brand-sand-soft px-4 py-3 text-sm">
          PPN belum diaktifkan di pengaturan pajak{settings.is_pkp ? "" : " (bengkel belum berstatus PKP)"}. Laporan ini tetap menampilkan PPN yang pernah tercatat.
        </p>
      )}

      <section className={cn(panel, "p-4 sm:p-5")}>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Dari
            <input type="date" name="dari" defaultValue={from} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Sampai
            <input type="date" name="sampai" defaultValue={to} className={inputClass} />
          </label>
          <Button type="submit">Tampilkan</Button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["PPN Keluaran", summary.keluaran],
          ["PPN Masukan", summary.masukan],
          [summary.selisih >= 0 ? "Kurang bayar" : "Lebih bayar", Math.abs(summary.selisih)],
          ["Sudah disetor", summary.disetor],
        ].map(([label, v]) => (
          <div key={label as string} className={cn(panel, "grid gap-1")}>
            <p className="text-sm text-muted-foreground">{label as string}</p>
            <p className="text-2xl font-bold tabular-nums">{formatRupiah(v as number)}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">Dari jurnal. PPN adalah titipan, jadi tidak mengurangi laba; pendapatan di laba rugi memakai nilai sebelum PPN. DPP keluaran periode ini {formatRupiah(dpp("keluaran") + dpp("retur_keluaran"))}.</p>

      <section className={cn(panel, "overflow-x-auto p-4 sm:p-6")}>
        <h2 className="mb-3 text-lg font-semibold">Daftar dokumen</h2>
        {docs.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Tidak ada dokumen ber-PPN pada periode ini.</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Tanggal</th>
                <th className="py-2 font-medium">Jenis</th>
                <th className="py-2 font-medium">Nomor</th>
                <th className="py-2 font-medium">Pihak</th>
                <th className="py-2 font-medium">NPWP</th>
                <th className="py-2 text-right font-medium">DPP</th>
                <th className="py-2 text-right font-medium">PPN</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={`${d.kind}-${d.doc_id}`} className="border-b border-border/60 last:border-0">
                  <td className="py-2">{formatDate(d.doc_date)}</td>
                  <td className="py-2">{KIND_LABEL[d.kind]}</td>
                  <td className="py-2 font-mono text-xs">{d.doc_no}</td>
                  <td className="py-2">{d.party}</td>
                  <td className="py-2 font-mono text-xs">{d.npwp ?? "-"}</td>
                  <td className="py-2 text-right tabular-nums">{formatRupiah(d.dpp)}</td>
                  <td className="py-2 text-right tabular-nums">{formatRupiah(d.ppn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={cn(panel, "grid gap-3 p-4 sm:p-6")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Setoran PPN</h2>
          {canPay && <PayTaxDialog taxType="ppn" cashAccounts={cash} today={today} suggested={Math.max(summary.selisih - summary.disetor, 0)} />}
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada setoran.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-3", p.status === "void" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", p.status === "void" && "line-through")}>
                    {formatDate(p.pay_date)} · {p.cash_bank_accounts.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.reference ?? "Tanpa referensi"}
                    {p.void_reason && ` · batal: ${p.void_reason}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatRupiah(p.amount)}</span>
                {p.status === "posted" && canPay && <VoidTaxPaymentButton id={p.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

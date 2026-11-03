import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getProfitLoss, summarizeProfitLoss } from "@/lib/finance";
import { formatDate, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { getTaxOverview, getTaxSettings, listCashAccounts, listTaxPayments } from "@/lib/tax";
import { BUSINESS_FORM_LABEL, PPH_MODE_LABEL } from "@/lib/validation/tax";
import { cn } from "@/lib/utils";
import { PayTaxDialog, PphMonthAction, VoidTaxPaymentButton } from "../_components/forms";
import { TaxNav } from "../_components/ui";

export default function PphPage({ searchParams }: PageProps<"/pajak/pph">) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5">
      <TaxNav active="pph" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "tax_settings", "view", false)) return <NoAccess />;
  const today = todayWib();
  const thisYear = Number(today.slice(0, 4));
  const raw = Number((await searchParams).tahun);
  const year = Number.isInteger(raw) && raw >= 2000 && raw <= 2100 ? raw : thisYear;
  const thisMonth = year === thisYear ? Number(today.slice(5, 7)) : year < thisYear ? 12 : 0;

  const [settings, months, payments, cash] = await Promise.all([getTaxSettings(), getTaxOverview(year), listTaxPayments("pph_final"), listCashAccounts()]);
  const canEdit = can(ctx, "tax_settings", "update", false);
  const canPay = can(ctx, "tax_settings", "create", false);

  const cumulative = months.reduce((last, m) => (m.month <= Math.max(thisMonth, 1) ? m.cumulative : last), 0);
  const pct = (cumulative / settings.annual_ceiling) * 100;
  const posted = months.reduce((t, m) => t + (m.posted_pph ?? 0), 0);
  const paid = payments.filter((p) => p.status === "posted").reduce((t, p) => t + p.amount, 0);
  const owed = Math.max(posted - paid, 0);

  // Estimasi PPh tarif umum: dari laba sebelum pajak tahun berjalan sampai hari ini (bukan jurnal)
  const estimate =
    settings.pph_mode === "general"
      ? summarizeProfitLoss(await getProfitLoss(`${year}-01-01`, year === thisYear ? today : `${year}-12-31`)).beforeTax
      : null;

  const dueDate = `${today.slice(0, 7)}-${String(settings.pph_due_day).padStart(2, "0")}`;

  return (
    <>
      <PageHeader
        title="PPh"
        description={`${BUSINESS_FORM_LABEL[settings.business_form]} · ${PPH_MODE_LABEL[settings.pph_mode]}`}
        actions={
          <nav className="flex gap-1" aria-label="Tahun">
            {[year - 1, year, year + 1].filter((y) => y <= thisYear).map((y) => (
              <Link key={y} href={`/pajak/pph?tahun=${y}`} className={cn("rounded-full px-4 py-2 text-sm font-medium", y === year ? "bg-brand-rail text-white" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {y}
              </Link>
            ))}
          </nav>
        }
      />

      {settings.pph_mode === "off" && (
        <p className="rounded-2xl bg-brand-sand-soft px-4 py-3 text-sm">
          PPh belum dihitung. Pilih PPh Final UMKM atau estimasi tarif umum di <Link href="/pajak" className="font-medium underline">pengaturan pajak</Link>. Laba bersih di laporan sama dengan laba sebelum pajak.
        </p>
      )}

      {settings.pph_mode === "final" && (
        <>
          {pct >= 80 && (
            <p className={cn("flex items-start gap-2 rounded-2xl px-4 py-3 text-sm", pct >= 95 ? "bg-brand-red-soft text-brand-red" : "bg-brand-sand-soft")}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Omzet {year} sudah {formatQty(Math.round(pct * 10) / 10)}% dari batas {formatRupiah(settings.annual_ceiling)}. {pct >= 95 ? "Hampir melewati batas PPh Final; segera konsultasikan dengan konsultan pajak." : "Pantau terus agar tidak melewati batas PPh Final."}
              </span>
            </p>
          )}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn(panel, "grid gap-1")}>
              <p className="text-sm text-muted-foreground">Omzet kumulatif {year}</p>
              <p className="text-2xl font-bold tabular-nums">{formatRupiah(cumulative)}</p>
              <span className="mt-1 h-1.5 rounded-full bg-brand-blue-soft">
                <span className={cn("block h-full rounded-full", pct >= 95 ? "bg-brand-red" : pct >= 80 ? "bg-brand-gold" : "bg-brand-blue-ink")} style={{ width: `${Math.min(100, Math.max(pct, 0))}%` }} />
              </span>
              <p className="text-xs text-muted-foreground">{formatQty(Math.round(pct * 10) / 10)}% dari batas {formatRupiah(settings.annual_ceiling)}</p>
            </div>
            <div className={cn(panel, "grid gap-1")}>
              <p className="text-sm text-muted-foreground">PPh Final diposting</p>
              <p className="text-2xl font-bold tabular-nums">{formatRupiah(posted)}</p>
            </div>
            <div className={cn(panel, "grid gap-1")}>
              <p className="text-sm text-muted-foreground">Sudah disetor</p>
              <p className="text-2xl font-bold tabular-nums">{formatRupiah(paid)}</p>
            </div>
            <div className={cn(panel, "grid gap-1")}>
              <p className="text-sm text-muted-foreground">Hutang PPh Final</p>
              <p className={cn("text-2xl font-bold tabular-nums", owed > 0 && "text-brand-red")}>{formatRupiah(owed)}</p>
              {owed > 0 && <p className="text-xs text-muted-foreground">Setor paling lambat tanggal {settings.pph_due_day} ({formatDate(dueDate)})</p>}
            </div>
          </section>

          <section className={cn(panel, "overflow-x-auto p-4 sm:p-6")}>
            <h2 className="mb-1 text-lg font-semibold">PPh Final per bulan</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {settings.pph_final_rate}% dari omzet kena pajak (pendapatan jasa dan part tanpa PPN, dikurangi retur).
              {settings.business_form === "orang_pribadi" && ` Omzet ${formatRupiah(settings.free_threshold)} pertama setahun bebas PPh.`}
            </p>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Bulan</th>
                  <th className="py-2 text-right font-medium">Omzet</th>
                  <th className="py-2 text-right font-medium">Kumulatif</th>
                  <th className="py-2 text-right font-medium">Kena pajak</th>
                  <th className="py-2 text-right font-medium">PPh Final</th>
                  <th className="py-2 text-right font-medium">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {months
                  .filter((m) => m.month <= thisMonth)
                  .map((m) => {
                    const ended = year < thisYear || m.month < Number(today.slice(5, 7));
                    return (
                      <tr key={m.month} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 font-medium">{MONTHS[m.month - 1]}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatRupiah(m.omzet)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatRupiah(m.cumulative)}</td>
                        <td className="py-2.5 text-right tabular-nums">{formatRupiah(m.taxable)}</td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">{formatRupiah(m.posted ? (m.posted_pph ?? 0) : m.pph)}</td>
                        <td className="py-2.5 text-right">
                          {m.posted ? (
                            <span className="rounded-full bg-brand-rail px-2.5 py-0.5 text-xs font-medium text-white">Diposting</span>
                          ) : ended ? (
                            <span className="rounded-full bg-brand-sand-soft px-2.5 py-0.5 text-xs font-medium">Belum diposting</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Bulan berjalan</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          {(m.posted || ended) && <PphMonthAction year={year} month={m.month} summaryId={m.summary_id} posted={m.posted} canPost={canEdit} pph={m.pph} />}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>

          <section className={cn(panel, "grid gap-3 p-4 sm:p-6")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Setoran PPh Final</h2>
              {canPay && <PayTaxDialog taxType="pph_final" cashAccounts={cash} today={today} suggested={owed} />}
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
                        {p.period_year && p.period_month ? `Masa ${MONTHS[p.period_month - 1]} ${p.period_year} · ` : ""}
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
      )}

      {settings.pph_mode === "general" && estimate != null && (
        <section className={cn(panel, "grid gap-2")}>
          <h2 className="text-lg font-semibold">Estimasi PPh tarif umum {year}</h2>
          <dl className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">Laba sebelum pajak (sampai {formatDate(year === thisYear ? today : `${year}-12-31`)})</dt>
            <dd className="text-right">{formatRupiah(estimate)}</dd>
            <dt className="text-muted-foreground">Tarif</dt>
            <dd className="text-right">{settings.general_rate}%</dd>
            <dt className="font-medium">Estimasi PPh</dt>
            <dd className="text-right text-xl font-bold">{formatRupiah(Math.max(estimate, 0) * (settings.general_rate / 100))}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">Hanya estimasi, tidak dijurnal. Fasilitas pengurangan tarif dan koreksi fiskal tidak dihitung. Konsultasikan dengan konsultan pajak.</p>
        </section>
      )}
    </>
  );
}

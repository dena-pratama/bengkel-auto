import { Suspense } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { NoAccess, PageHeader, Skeleton, inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { can, requireUser } from "@/lib/auth";
import {
  getBalanceSheet,
  getCashFlow,
  getMargin,
  getProfitLoss,
  listCashBankBalances,
  summarizeProfitLoss,
  type BsRow,
  type CashFlowRow,
  type MarginRow,
  type PlRow,
} from "@/lib/finance";
import { addDays, formatDate, formatQty, formatRupiah, todayWib } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/validation/finance";
import { cn } from "@/lib/utils";
import { DATE, FinanceNav, monthRange, previousRange } from "../_components/ui";

const KINDS = [
  { key: "laba-rugi", label: "Laba rugi" },
  { key: "neraca", label: "Neraca" },
  { key: "arus-kas", label: "Arus kas" },
  { key: "margin", label: "Margin" },
] as const;
type Kind = (typeof KINDS)[number]["key"];
const GROUPS = [
  { key: "jasa", label: "Per jasa", rpc: "service" },
  { key: "barang", label: "Per barang", rpc: "item" },
  { key: "wo", label: "Per work order", rpc: "wo" },
] as const;

export default function ReportsPage({ searchParams }: PageProps<"/keuangan/laporan">) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "finance_reports", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const kind: Kind = KINDS.some((k) => k.key === pick(sp.jenis)) ? (pick(sp.jenis) as Kind) : "laba-rugi";
  const month = monthRange(today);
  const from = DATE.test(pick(sp.dari) ?? "") ? pick(sp.dari)! : month.from;
  const to = DATE.test(pick(sp.sampai) ?? "") && pick(sp.sampai)! >= from ? pick(sp.sampai)! : month.to;
  const group = GROUPS.find((g) => g.key === pick(sp.kelompok)) ?? GROUPS[0];
  const compare = pick(sp.bandingkan) === "1";
  const prev = previousRange(from, to);

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ jenis: kind, dari: from, sampai: to, ...(compare ? { bandingkan: "1" } : {}), ...(kind === "margin" ? { kelompok: group.key } : {}), ...over });
    return `?${p.toString()}`;
  };
  const lastMonth = monthRange(today, -1);
  const presets = [
    { label: "Bulan ini", from: month.from, to: month.to },
    { label: "Bulan lalu", from: lastMonth.from, to: lastMonth.to },
    { label: "Tahun ini", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];

  return (
    <>
      <FinanceNav active="reports" showReports showLedger />
      <PageHeader
        title="Laporan keuangan"
        description={kind === "neraca" ? `Per ${formatDate(to)}` : `${formatDate(from)} s/d ${formatDate(to)}`}
        actions={
          <Button variant="outline" nativeButton={false} render={<a href={`/api/v1/keuangan/export${qs({})}`} />}>
            <Download className="size-4" /> Ekspor Excel
          </Button>
        }
      />

      <section className={cn(panel, "grid gap-4")}>
        <nav className="flex flex-wrap gap-1" aria-label="Jenis laporan">
          {KINDS.map((k) => (
            <Link
              key={k.key}
              href={qs({ jenis: k.key })}
              aria-current={kind === k.key ? "page" : undefined}
              className={cn("rounded-full px-4 py-2 text-sm font-medium transition-colors", kind === k.key ? "bg-brand-rail text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {k.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="jenis" value={kind} />
          {kind === "margin" && <input type="hidden" name="kelompok" value={group.key} />}
          {kind !== "neraca" && (
            <label className="grid gap-1.5 text-sm font-medium">
              Dari
              <input type="date" name="dari" defaultValue={from} className={inputClass} />
            </label>
          )}
          {kind === "neraca" && <input type="hidden" name="dari" value={from} />}
          <label className="grid gap-1.5 text-sm font-medium">
            {kind === "neraca" ? "Per tanggal" : "Sampai"}
            <input type="date" name="sampai" defaultValue={to} className={inputClass} />
          </label>
          {(kind === "laba-rugi" || kind === "neraca") && (
            <label className="flex h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="bandingkan" value="1" defaultChecked={compare} className="size-4 accent-brand-blue-ink" />
              Bandingkan periode sebelumnya
            </label>
          )}
          <Button type="submit">Tampilkan</Button>
          <span className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <Link key={p.label} href={qs({ dari: p.from, sampai: p.to })} className="rounded-full bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                {p.label}
              </Link>
            ))}
          </span>
        </form>
      </section>

      <Suspense fallback={<Skeleton className="h-96" />}>
        {kind === "laba-rugi" && <ProfitLoss from={from} to={to} prev={compare ? prev : null} />}
        {kind === "neraca" && <BalanceSheet to={to} prevTo={compare ? prev.to : null} />}
        {kind === "arus-kas" && <CashFlow from={from} to={to} />}
        {kind === "margin" && <Margin group={group} from={from} to={to} hrefFor={(g) => qs({ kelompok: g })} />}
      </Suspense>
    </>
  );
}

// ---------------------------------------------------------------------------- Tabel

function Money({ v, bold, neg }: { v: number | null; bold?: boolean; neg?: boolean }) {
  if (v == null) return <span className="text-muted-foreground">-</span>;
  return <span className={cn("tabular-nums", bold && "font-semibold", (neg ?? v < 0) && v !== 0 && "text-brand-red")}>{formatRupiah(v)}</span>;
}

type Line = { key: string; label: string; cur: number; prev: number | null; bold?: boolean; indent?: boolean; strong?: boolean };

function ReportTable({ lines, showPrev, head }: { lines: Line[]; showPrev: boolean; head: [string, string?] }) {
  return (
    <section className={cn(panel, "overflow-x-auto p-4 sm:p-6")}>
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Uraian</th>
            <th className="py-2 text-right font-medium">{head[0]}</th>
            {showPrev && <th className="py-2 text-right font-medium">{head[1]}</th>}
            {showPrev && <th className="py-2 text-right font-medium">Selisih</th>}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className={cn("border-b border-border/60 last:border-0", l.strong && "bg-muted/60")}>
              <td className={cn("py-2", l.indent && "pl-5", l.bold && "font-semibold")}>{l.label}</td>
              <td className="py-2 text-right">
                <Money v={l.cur} bold={l.bold} />
              </td>
              {showPrev && (
                <td className="py-2 text-right">
                  <Money v={l.prev} bold={l.bold} />
                </td>
              )}
              {showPrev && (
                <td className="py-2 text-right">
                  <Money v={l.prev == null ? null : l.cur - l.prev} bold={l.bold} neg={false} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function sectionLines(title: string, rows: { code: string; name: string; amount: number }[], prevRows: { code: string; name: string; amount: number }[] | null, keyBase: string): Line[] {
  const codes = [...new Set([...rows.map((r) => r.code), ...(prevRows ?? []).map((r) => r.code)])].sort();
  const total = rows.reduce((t, r) => t + r.amount, 0);
  const prevTotal = prevRows ? prevRows.reduce((t, r) => t + r.amount, 0) : null;
  return [
    { key: `${keyBase}-h`, label: title, cur: total, prev: prevTotal, bold: true },
    ...codes.map((c): Line => {
      const cur = rows.find((r) => r.code === c);
      const pv = prevRows?.find((r) => r.code === c);
      return { key: `${keyBase}-${c}`, label: `${c}  ${cur?.name ?? pv?.name ?? ""}`, cur: cur?.amount ?? 0, prev: prevRows ? (pv?.amount ?? 0) : null, indent: true };
    }),
  ];
}

// ---------------------------------------------------------------------------- Laba rugi

async function ProfitLoss({ from, to, prev }: { from: string; to: string; prev: { from: string; to: string } | null }) {
  const [rows, prevRows] = await Promise.all([getProfitLoss(from, to), prev ? getProfitLoss(prev.from, prev.to) : Promise.resolve(null)]);
  const sec = (r: PlRow[] | null, s: PlRow["section"]) => (r ? r.filter((x) => x.section === s) : null);
  const cur = summarizeProfitLoss(rows);
  const pv = prevRows ? summarizeProfitLoss(prevRows) : null;
  const total = (label: string, key: string, c: number, p: number | null | undefined, strong = false): Line => ({ key, label, cur: c, prev: p ?? null, bold: true, strong });
  const lines: Line[] = [
    ...sectionLines("Pendapatan (tanpa PPN)", sec(rows, "revenue")!, sec(prevRows, "revenue"), "rev"),
    ...sectionLines("Harga pokok penjualan", sec(rows, "cogs")!, sec(prevRows, "cogs"), "cogs"),
    total("Laba kotor", "gross", cur.grossProfit, pv?.grossProfit, true),
    ...sectionLines("Beban usaha", sec(rows, "expense")!, sec(prevRows, "expense"), "exp"),
    total("Laba usaha", "op", cur.operatingProfit, pv?.operatingProfit, true),
    ...sectionLines("Pendapatan (beban) lain", sec(rows, "other")!, sec(prevRows, "other"), "oth"),
    total("Laba sebelum pajak", "pbt", cur.beforeTax, pv?.beforeTax, true),
    ...sectionLines("Pajak penghasilan", sec(rows, "tax")!, sec(prevRows, "tax"), "tax"),
    total("Laba bersih setelah pajak", "net", cur.net, pv?.net, true),
  ];
  const margin = cur.revenue > 0 ? (cur.net / cur.revenue) * 100 : null;
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Pendapatan", cur.revenue],
          ["Laba kotor", cur.grossProfit],
          ["Laba bersih", cur.net],
        ].map(([label, v]) => (
          <div key={label as string} className={cn(panel, "grid gap-1")}>
            <p className="text-sm text-muted-foreground">{label as string}</p>
            <p className={cn("text-2xl font-bold tabular-nums", (v as number) < 0 && "text-brand-red")}>{formatRupiah(v as number)}</p>
            {label === "Laba bersih" && margin != null && <p className="text-xs text-muted-foreground">Margin bersih {formatQty(Math.round(margin * 10) / 10)}%</p>}
          </div>
        ))}
      </section>
      <ReportTable lines={lines} showPrev={Boolean(prev)} head={["Periode ini", prev ? `${formatDate(prev.from)} s/d ${formatDate(prev.to)}` : undefined]} />
      <p className="text-xs text-muted-foreground">Pendapatan dan HPP tanpa PPN. Beban garansi, selisih persediaan, dan selisih kas termasuk beban usaha.</p>
    </>
  );
}

// ---------------------------------------------------------------------------- Neraca

async function BalanceSheet({ to, prevTo }: { to: string; prevTo: string | null }) {
  const [rows, prevRows] = await Promise.all([getBalanceSheet(to), prevTo ? getBalanceSheet(prevTo) : Promise.resolve(null)]);
  const sec = (r: BsRow[] | null, s: BsRow["section"]) => (r ? r.filter((x) => x.section === s) : null);
  const sum = (r: BsRow[] | null, s: BsRow["section"]) => (r ? r.filter((x) => x.section === s).reduce((t, x) => t + x.amount, 0) : null);
  const lines: Line[] = [
    ...sectionLines("Aset", sec(rows, "asset")!, sec(prevRows, "asset"), "as"),
    ...sectionLines("Kewajiban", sec(rows, "liability")!, sec(prevRows, "liability"), "li"),
    ...sectionLines("Modal", sec(rows, "equity")!, sec(prevRows, "equity"), "eq"),
    {
      key: "check",
      label: "Kewajiban + modal",
      cur: (sum(rows, "liability") ?? 0) + (sum(rows, "equity") ?? 0),
      prev: prevRows ? (sum(prevRows, "liability") ?? 0) + (sum(prevRows, "equity") ?? 0) : null,
      bold: true,
      strong: true,
    },
  ];
  const balanced = Math.abs((sum(rows, "asset") ?? 0) - lines[lines.length - 1].cur) < 0.005;
  return (
    <>
      <ReportTable lines={lines} showPrev={Boolean(prevTo)} head={[`Per ${formatDate(to)}`, prevTo ? `Per ${formatDate(prevTo)}` : undefined]} />
      <p className={cn("text-xs", balanced ? "text-muted-foreground" : "font-medium text-brand-red")}>
        {balanced ? "Neraca seimbang: aset sama dengan kewajiban ditambah modal. Laba berjalan dihitung kumulatif dari seluruh jurnal." : "Neraca tidak seimbang. Periksa jurnal."}
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------- Arus kas

const CATS: { key: CashFlowRow["category"]; label: string }[] = [
  { key: "operating", label: "Arus kas dari operasi" },
  { key: "investing", label: "Arus kas dari investasi" },
  { key: "financing", label: "Arus kas dari pendanaan" },
];

async function CashFlow({ from, to }: { from: string; to: string }) {
  const [rows, opening, closing] = await Promise.all([getCashFlow(from, to), listCashBankBalances(addDays(from, -1)), listCashBankBalances(to)]);
  const open = opening.reduce((t, b) => t + b.balance, 0);
  const close = closing.reduce((t, b) => t + b.balance, 0);
  const net = rows.reduce((t, r) => t + r.inflow - r.outflow, 0);
  return (
    <>
      <section className={cn(panel, "overflow-x-auto p-4 sm:p-6")}>
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Uraian</th>
              <th className="py-2 text-right font-medium">Masuk</th>
              <th className="py-2 text-right font-medium">Keluar</th>
              <th className="py-2 text-right font-medium">Bersih</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-muted/60">
              <td className="py-2 font-semibold">Saldo kas & bank awal</td>
              <td />
              <td />
              <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(open)}</td>
            </tr>
            {CATS.map((c) => {
              const items = rows.filter((r) => r.category === c.key);
              const cin = items.reduce((t, r) => t + r.inflow, 0);
              const cout = items.reduce((t, r) => t + r.outflow, 0);
              return (
                <FlowGroup key={c.key} label={c.label} items={items} inflow={cin} outflow={cout} />
              );
            })}
            <tr className="bg-muted/60">
              <td className="py-2 font-semibold">Kenaikan (penurunan) kas bersih</td>
              <td />
              <td />
              <td className="py-2 text-right font-semibold tabular-nums">
                <Money v={net} bold />
              </td>
            </tr>
            <tr className="bg-muted/60">
              <td className="py-2 font-semibold">Saldo kas & bank akhir</td>
              <td />
              <td />
              <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(close)}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <p className={cn("text-xs", Math.abs(open + net - close) < 0.005 ? "text-muted-foreground" : "font-medium text-brand-red")}>
        {Math.abs(open + net - close) < 0.005
          ? "Metode langsung, dari jurnal yang menyentuh akun kas dan bank. Transfer antar akun kas tidak dihitung."
          : "Saldo awal ditambah kenaikan bersih tidak sama dengan saldo akhir. Periksa jurnal."}
      </p>
    </>
  );
}

function FlowGroup({ label, items, inflow, outflow }: { label: string; items: CashFlowRow[]; inflow: number; outflow: number }) {
  return (
    <>
      <tr className="border-b border-border/60">
        <td className="py-2 font-semibold">{label}</td>
        <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(inflow)}</td>
        <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(outflow)}</td>
        <td className="py-2 text-right font-semibold">
          <Money v={inflow - outflow} bold />
        </td>
      </tr>
      {items.map((r) => (
        <tr key={`${r.category}-${r.source_type}`} className="border-b border-border/60">
          <td className="py-1.5 pl-5">{SOURCE_LABEL[r.source_type] ?? r.source_type}</td>
          <td className="py-1.5 text-right tabular-nums">{formatRupiah(r.inflow)}</td>
          <td className="py-1.5 text-right tabular-nums">{formatRupiah(r.outflow)}</td>
          <td className="py-1.5 text-right">
            <Money v={r.inflow - r.outflow} />
          </td>
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------- Margin

async function Margin({ group, from, to, hrefFor }: { group: (typeof GROUPS)[number]; from: string; to: string; hrefFor: (g: string) => string }) {
  const rows: MarginRow[] = await getMargin(group.rpc, from, to);
  const revenue = rows.reduce((t, r) => t + r.revenue, 0);
  const cost = rows.reduce((t, r) => t + r.cost, 0);
  return (
    <>
      <nav className="flex flex-wrap gap-1" aria-label="Kelompok margin">
        {GROUPS.map((g) => (
          <Link
            key={g.key}
            href={hrefFor(g.key)}
            aria-current={g.key === group.key ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-sm font-medium", g.key === group.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {g.label}
          </Link>
        ))}
      </nav>
      <section className={cn(panel, "overflow-x-auto p-4 sm:p-6")}>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada invoice pada periode ini.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">{group.key === "wo" ? "Work order" : group.key === "jasa" ? "Jasa" : "Barang"}</th>
                <th className="py-2 text-right font-medium">{group.key === "wo" ? "Baris" : "Jumlah"}</th>
                <th className="py-2 text-right font-medium">Pendapatan</th>
                <th className="py-2 text-right font-medium">HPP</th>
                <th className="py-2 text-right font-medium">Margin</th>
                <th className="py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key_id} className="border-b border-border/60 last:border-0">
                  <td className="py-2">
                    <span className="font-medium">{r.label}</span> <span className="font-mono text-xs text-muted-foreground">{r.sublabel}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatQty(r.qty)}</td>
                  <td className="py-2 text-right tabular-nums">{formatRupiah(r.revenue)}</td>
                  <td className="py-2 text-right tabular-nums">{formatRupiah(r.cost)}</td>
                  <td className="py-2 text-right">
                    <Money v={r.margin} bold />
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.revenue > 0 ? `${formatQty(Math.round((r.margin / r.revenue) * 1000) / 10)}%` : "-"}</td>
                </tr>
              ))}
              <tr className="bg-muted/60">
                <td className="py-2 font-semibold">Total</td>
                <td />
                <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(revenue)}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{formatRupiah(cost)}</td>
                <td className="py-2 text-right font-semibold">
                  <Money v={revenue - cost} bold />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-muted-foreground">Margin dari invoice yang diposting: pendapatan setelah diskon dikurangi HPP part. Komisi mekanik belum dihitung sebagai biaya.</p>
    </>
  );
}

import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { describeRange, readRange } from "@/lib/list-filter";
import { getWarrantyReport, type WarrantyReport } from "@/lib/service";
import { cn } from "@/lib/utils";
import { ServiceNav } from "../_components/ui";

export default function WarrantyReportPage({ searchParams }: PageProps<"/servis/garansi">) {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}


async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "finance_reports", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "tahun-ini");
  const from = range.from ?? "2000-01-01";
  const to = range.to ?? today;

  return (
    <>
      <ServiceNav active="warranty" showEstimates={can(ctx, "service_orders", "view", false)} showWarranty />
      <PageHeader title="Klaim garansi" description={`${describeRange(range, formatDate)}. Garansi dihitung dari tanggal invoice.`} />
      <ListFilter today={today} range={range} defaultRange="tahun-ini" dateLabel="Tanggal klaim" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Report from={from} to={to} />
      </Suspense>
    </>
  );
}

async function Report({ from, to }: { from: string; to: string }) {
  const r = await getWarrantyReport(from, to);
  if (r.claim_orders === 0) return <EmptyState icon={ShieldCheck} text="Tidak ada klaim garansi pada periode ini." />;
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Work order klaim", String(r.claim_orders)],
          ["Baris jasa dan part diklaim", String(r.claim_lines)],
          ["Biaya part (HPP)", formatRupiah(r.part_cost)],
        ].map(([label, v]) => (
          <div key={label} className={cn(panel, "grid gap-1")}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Group title="Per mekanik (pengerjaan asal)" hint="Mekanik yang mengerjakan baris servis yang kemudian diklaim." rows={r.by_mechanic.map((x) => ({ key: x.name, label: x.name, claims: x.claims, cost: x.part_cost }))} />
        <Group title="Per supplier" hint="Supplier penerimaan terakhir barang itu sebelum dijual." rows={r.by_supplier.map((x) => ({ key: x.name, label: x.name, claims: x.claims, cost: x.part_cost }))} />
      </div>
      <Group
        title="Per barang dan jasa"
        hint="Yang sering muncul di sini patut diperiksa mutu atau cara pemasangannya."
        rows={r.by_item.map((x) => ({ key: `${x.kind}-${x.code}-${x.name}`, label: `${x.name}${x.code ? ` (${x.code})` : ""}`, claims: x.claims, cost: x.part_cost, tag: x.kind === "part" ? "Part" : "Jasa" }))}
      />
      <Claims claims={r.claims} />
    </>
  );
}

function Group({ title, hint, rows }: { title: string; hint: string; rows: { key: string; label: string; claims: number; cost: number; tag?: string }[] }) {
  return (
    <section className={cn(panel, "grid content-start gap-2")}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada data.</p>
      ) : (
        <ul className="grid divide-y divide-border">
          {rows.map((x) => (
            <li key={x.key} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">
                {x.tag && <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{x.tag}</span>}
                {x.label}
              </span>
              <span className="w-20 text-right tabular-nums">{x.claims} klaim</span>
              <span className="w-28 text-right font-semibold tabular-nums">{formatRupiah(x.cost)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Claims({ claims }: { claims: WarrantyReport["claims"] }) {
  return (
    <section className={cn(panel, "grid gap-2")}>
      <h2 className="text-lg font-semibold">Daftar klaim</h2>
      <ul className="grid divide-y divide-border">
        {claims.map((c, i) => (
          <li key={`${c.wo_no}-${i}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{c.description}</span>
              <span className="block text-xs text-muted-foreground">
                {c.plate_no} · {c.wo_no}
                {c.src_wo_no && ` dari ${c.src_wo_no}`} · {formatDate(c.created_at)}
              </span>
            </span>
            <span className="font-semibold tabular-nums">{formatRupiah(c.part_cost)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

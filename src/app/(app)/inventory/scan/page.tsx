import { Suspense } from "react";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { resolveScan, type ScanItem, type ScanLocation } from "@/lib/scan";
import { MOVEMENT_LABEL } from "@/lib/validation/inventory";
import { cn } from "@/lib/utils";
import { InventoryNav } from "../_components/nav";
import { ScanForm } from "./_scan-form";

export default function ScanPage({ searchParams }: PageProps<"/inventory/scan">) {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <InventoryNav active="scan" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const sp = await searchParams;
  const code = typeof sp.kode === "string" ? sp.kode.slice(0, 60) : "";

  return (
    <>
      <PageHeader title="Scan QR" description="Scan QR barang untuk melihat stok dan harga, atau QR rak untuk melihat isinya." />
      <section className={cn(panel, "grid gap-3")}>
        <ScanForm initial={code} />
      </section>
      {code ? (
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Result code={code} canTransfer={can(ctx, "master_data", "update", false) || can(ctx, "stock_opname_count", "update", false)} />
        </Suspense>
      ) : (
        <EmptyState icon={ScanLine} text="Belum ada yang discan." />
      )}
    </>
  );
}

async function Result({ code, canTransfer }: { code: string; canTransfer: boolean }) {
  const r = await resolveScan(code);
  if (r.kind === "invalid") return <EmptyState icon={ScanLine} text="Kode tidak dikenali. Gunakan QR dari label barang atau rak." />;
  if (r.kind === "notfound") return <EmptyState icon={ScanLine} text={`Kode ${r.code} tidak ditemukan sebagai barang maupun rak.`} />;
  return r.kind === "item" ? <ItemResult r={r} canTransfer={canTransfer} /> : <LocationResult r={r} />;
}

function ItemResult({ r, canTransfer }: { r: ScanItem; canTransfer: boolean }) {
  const low = r.min_stock > 0 && r.total_qty <= r.min_stock;
  return (
    <section className={cn(panel, "grid gap-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>
          <h2 className="text-xl font-semibold tracking-tight">{r.name}</h2>
          {!r.is_active && <span className="mt-1 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Nonaktif</span>}
        </div>
        <div className="text-right">
          <p className={cn("text-3xl font-bold tabular-nums", low && "text-brand-red")}>
            {formatQty(r.total_qty)} <span className="text-base font-medium text-muted-foreground">{r.unit}</span>
          </p>
          <p className="text-xs text-muted-foreground">{low ? `Menipis (minimum ${formatQty(r.min_stock)})` : r.min_stock > 0 ? `Minimum ${formatQty(r.min_stock)}` : "Stok minimum belum diatur"}</p>
        </div>
      </div>
      <p className="text-sm">
        Harga jual <span className="font-semibold tabular-nums">{formatRupiah(r.sell_price)}</span>
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">Stok per lokasi</h3>
          {r.locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada stok di rak mana pun.</p>
          ) : (
            <ul className="grid divide-y divide-border">
              {r.locations.map((l) => (
                <li key={l.location_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <Link href={`/inventory/scan?kode=${encodeURIComponent(`L:${l.code}`)}`} className="font-medium hover:underline">
                    {l.code} <span className="font-normal text-muted-foreground">{l.name}</span>
                  </Link>
                  <span className="font-semibold tabular-nums">{formatQty(l.qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-semibold">10 mutasi terakhir</h3>
          {r.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada mutasi.</p>
          ) : (
            <ul className="grid divide-y divide-border">
              {r.movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.location_code} · {formatDateTime(m.created_at)}
                    </span>
                  </span>
                  <span className={cn("font-semibold tabular-nums", m.qty < 0 && "text-brand-red")}>{m.qty > 0 ? `+${formatQty(m.qty)}` : formatQty(m.qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/inventory/barang/${r.id}`} className="rounded-full bg-muted px-4 py-2 font-medium hover:bg-brand-blue-soft">
          Buka detail barang
        </Link>
        {canTransfer && (
          <Link href={`/inventory/barang/${r.id}#stok`} className="rounded-full bg-muted px-4 py-2 font-medium hover:bg-brand-blue-soft">
            Pindah lokasi
          </Link>
        )}
      </div>
    </section>
  );
}

function LocationResult({ r }: { r: ScanLocation }) {
  return (
    <section className={cn(panel, "grid gap-4")}>
      <div>
        <p className="font-mono text-xs text-muted-foreground">{r.code}</p>
        <h2 className="text-xl font-semibold tracking-tight">{r.name}</h2>
        <p className="text-sm text-muted-foreground">{r.items.length} jenis barang di lokasi ini</p>
      </div>
      {r.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rak ini kosong.</p>
      ) : (
        <ul className="grid divide-y divide-border">
          {r.items.map((i) => (
            <li key={i.item_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <Link href={`/inventory/scan?kode=${encodeURIComponent(`I:${i.sku}`)}`} className="min-w-0 hover:underline">
                <span className="block truncate font-medium">{i.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{i.sku}</span>
              </Link>
              <span className="font-semibold tabular-nums">
                {formatQty(i.qty)} {i.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

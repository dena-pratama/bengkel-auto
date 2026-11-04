import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertCircle, AlertTriangle, Package, Wallet } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { ItemListRow } from "@/lib/inventory";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InventoryNav } from "@/app/(app)/inventory/_components/nav";
import { ItemsTable } from "@/app/(app)/inventory/_components/items-table";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Inventory", position: "Kepala Gudang", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "Kepala Gudang" }],
  permissions: [],
};

const SAMPLE_ITEMS: ItemListRow[] = [
  {
    id: "item-1",
    sku: "FLTR-OLI-AVNZA-01",
    name: "Filter Oli Avanza",
    is_active: true,
    sell_price: 95000,
    min_stock: 10,
    category_id: "cat-1",
    category: "Filter",
    brand: "Toyota Genuine",
    unit: "pcs",
    part_numbers: ["15601-BZ010"],
    compat: ["Toyota Avanza 2012-2021", "Daihatsu Xenia 2012-2021"],
    qty: 3,
  },
  {
    id: "item-2",
    sku: "KR-HD-114",
    name: "Kampas Rem Depan Jazz",
    is_active: true,
    sell_price: 385000,
    min_stock: 6,
    category_id: "cat-2",
    category: "Rem",
    brand: "Honda Genuine",
    unit: "set",
    part_numbers: ["45022-TF0-G01"],
    compat: ["Honda Jazz GE8 2008-2014", "Honda City 2009-2014"],
    qty: 2,
  },
  {
    id: "item-3",
    sku: "OL-SH-1040",
    name: "Oli Mesin 10W-40 1L",
    is_active: true,
    sell_price: 78000,
    min_stock: 24,
    category_id: "cat-3",
    category: "Oli & pelumas",
    brand: "Shell Helix",
    unit: "btl",
    part_numbers: [],
    compat: [],
    qty: 6,
  },
  {
    id: "item-4",
    sku: "BS-NGK-IR5",
    name: "Busi Iridium IX",
    is_active: true,
    sell_price: 110000,
    min_stock: 10,
    category_id: "cat-4",
    category: "Kelistrikan",
    brand: "NGK",
    unit: "pcs",
    part_numbers: ["BKR6EIX"],
    compat: ["Universal Bensin"],
    qty: 32,
  },
  {
    id: "item-5",
    sku: "FB-TY-5PK1140",
    name: "Fan Belt Avanza Dual VVT-i",
    is_active: true,
    sell_price: 125000,
    min_stock: 4,
    category_id: "cat-5",
    category: "Mesin",
    brand: "Toyota Genuine",
    unit: "pcs",
    part_numbers: ["90916-T2030"],
    compat: ["Toyota Avanza Grand New 2015-2021"],
    qty: 0,
  },
  {
    id: "item-6",
    sku: "LP-OS-H4",
    name: "Lampu Depan H4 Standard",
    is_active: true,
    sell_price: 65000,
    min_stock: 8,
    category_id: "cat-4",
    category: "Kelistrikan",
    brand: "Osram",
    unit: "pcs",
    part_numbers: ["64193"],
    compat: ["Universal H4"],
    qty: 18,
  },
];

export default function InventoryPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau barang...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  const activeCount = SAMPLE_ITEMS.filter((i) => i.is_active).length;
  const lowCount = SAMPLE_ITEMS.filter((i) => i.is_active && i.min_stock > 0 && i.qty > 0 && i.qty <= i.min_stock).length;
  const outOfStockCount = SAMPLE_ITEMS.filter((i) => i.is_active && i.qty <= 0).length;
  const inventoryValue = SAMPLE_ITEMS.reduce((sum, i) => sum + (i.qty > 0 ? i.qty * i.sell_price : 0), 0);

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <InventoryNav active="items" />
        <PageHeader
          title="Barang & suku cadang"
          description={`${activeCount} barang aktif · ${lowCount} stok menipis`}
          actions={
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
                Scan QR
              </button>
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:bg-muted">
                Cetak label
              </button>
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-rail/90">
                Tambah barang
              </button>
            </div>
          }
        />

        {/* Summary 4 cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <Package className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total SKU aktif</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{activeCount}</p>
              <p className="text-[11px] text-muted-foreground">dari {SAMPLE_ITEMS.length} barang</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <Wallet className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Nilai persediaan</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{formatRupiah(inventoryValue)}</p>
              <p className="text-[11px] text-muted-foreground">harga jual estimasi</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <AlertTriangle className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Stok menipis</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{lowCount} barang</p>
              <p className="text-[11px] text-muted-foreground">di bawah minimum</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
              <AlertCircle className="size-5 text-brand-red" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Stok habis</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{outOfStockCount} barang</p>
              <p className="text-[11px] text-muted-foreground">perlu PO segera</p>
            </div>
          </section>
        </div>

        <ItemsTable items={SAMPLE_ITEMS} />
      </div>
    </AppShell>
  );
}

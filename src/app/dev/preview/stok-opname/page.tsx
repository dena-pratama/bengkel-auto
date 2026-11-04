import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { StockOpnameRow } from "@/lib/stock-opname";
import { cn } from "@/lib/utils";
import { OpnameList } from "@/app/(app)/stok-opname/_components/opname-list";
import { formatRp } from "@/app/(app)/stok-opname/_components/ui";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Opname", position: "Kepala Gudang", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "Kepala Gudang" }],
  permissions: [],
};

function createMockOpname(
  partial: Partial<StockOpnameRow> & Pick<StockOpnameRow, "id" | "opname_no" | "opname_type" | "status">
): StockOpnameRow {
  return {
    branch_id: "br-1",
    branch_name: "Bengkel Pusat",
    is_blind_count: true,
    scope_filter: {},
    assigned_to: "emp-1",
    assigned_name: "Rudi",
    notes: null,
    total_items: 20,
    matched_items: 0,
    variance_items: 0,
    total_variance_amount: 0,
    accuracy_pct: 0,
    started_at: null,
    counted_at: null,
    completed_at: null,
    approved_by: null,
    approved_name: null,
    approved_at: null,
    journal_id: null,
    journal_no: null,
    void_reason: null,
    created_at: new Date().toISOString(),
    created_by: "emp-preview",
    created_by_name: "Tama Opname",
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

const SAMPLE_OPNAMES: StockOpnameRow[] = [
  createMockOpname({
    id: "so-1",
    opname_no: "SO-2611-0006",
    opname_type: "cycle_count",
    status: "draft",
    notes: "Acak 20 item bernilai tinggi",
    total_items: 20,
  }),
  createMockOpname({
    id: "so-2",
    opname_no: "SO-2611-0005",
    opname_type: "location",
    status: "in_progress",
    scope_filter: { location_ids: ["loc-1"] },
    assigned_to: "emp-2",
    assigned_name: "Dedi",
    notes: "Rak A1 - A4",
    total_items: 30,
    matched_items: 15,
    variance_items: 3,
    total_variance_amount: -150000,
    accuracy_pct: 83.3,
    started_at: "2026-11-04T09:10:00Z",
  }),
  createMockOpname({
    id: "so-3",
    opname_no: "SO-2611-0004",
    opname_type: "full",
    status: "posted",
    assigned_to: "emp-3",
    assigned_name: "Joko",
    notes: "Semua rak bulanan",
    total_items: 120,
    matched_items: 116,
    variance_items: 4,
    total_variance_amount: -450000,
    accuracy_pct: 96.8,
    started_at: "2026-10-31T08:00:00Z",
    counted_at: "2026-10-31T15:00:00Z",
    completed_at: "2026-10-31T16:30:00Z",
    approved_by: "Owner",
    approved_name: "Pak Budi",
    approved_at: "2026-10-31T17:00:00Z",
    journal_no: "JU-2610-0012",
  }),
  createMockOpname({
    id: "so-4",
    opname_no: "SO-2611-0003",
    opname_type: "category",
    status: "review",
    is_blind_count: false,
    scope_filter: { category_ids: ["cat-1"] },
    assigned_to: "emp-2",
    assigned_name: "Dedi",
    notes: "Kategori Filter & Oli",
    total_items: 45,
    matched_items: 41,
    variance_items: 4,
    total_variance_amount: -790000,
    accuracy_pct: 91.1,
    started_at: "2026-10-25T09:00:00Z",
    counted_at: "2026-10-25T13:00:00Z",
  }),
];

export default function StockOpnamePreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau stok opname...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <PageHeader
          title="Stok Opname"
          description="Bulan ini · 4 sesi. Pencocokan stok fisik gudang dengan sistem, mode blind count, dan penyesuaian otomatis."
          actions={
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-rail/90">
              Mulai sesi baru
            </button>
          }
        />

        {/* Summary 4 cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <ClipboardList className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sesi tercatat</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">4</p>
              <p className="text-[11px] text-muted-foreground">1 sedang berjalan</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <CheckCircle2 className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Akurasi rata-rata</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">96.8%</p>
              <p className="text-[11px] text-muted-foreground">dari 1 sesi selesai</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <AlertTriangle className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Menunggu tinjauan</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">1 sesi</p>
              <p className="text-[11px] text-muted-foreground">perlu persetujuan</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
              <AlertCircle className="size-5 text-brand-red" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Selisih nilai</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">{formatRp(-1390000)}</p>
              <p className="text-[11px] text-muted-foreground">akumulasi sesi</p>
            </div>
          </section>
        </div>

        <OpnameList items={SAMPLE_OPNAMES} />
      </div>
    </AppShell>
  );
}

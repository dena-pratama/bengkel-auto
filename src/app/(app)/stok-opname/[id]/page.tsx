import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Calendar, Clock, EyeOff, User } from "lucide-react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { getStockOpname } from "@/lib/stock-opname";
import { CountSheet } from "../_components/count-sheet";
import { ReviewPanel } from "../_components/review-panel";
import { OpnameStatusBadge, OpnameTypeBadge } from "../_components/ui";
import { VoidOpnameDialog } from "../_components/void-dialog";

export async function generateMetadata({ params }: PageProps<"/stok-opname/[id]">) {
  const { id } = await params;
  return {
    title: `Sesi Opname ${id.slice(0, 8)}`,
  };
}

export default function OpnameDetailPage({ params }: PageProps<"/stok-opname/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUser();
  const canView =
    can(ctx, "stock_opname_count", "view", false) ||
    can(ctx, "stock_opname_approve", "view", false) ||
    can(ctx, "master_data", "view", false);

  if (!canView) return <NoAccess />;

  const detail = await getStockOpname(id);
  if (!detail) notFound();

  const canCount = can(ctx, "stock_opname_count", "update", false);
  const canApprove = can(ctx, "stock_opname_approve", "approve", false);
  const canVoid = can(ctx, "stock_opname_count", "void", false);

  const canBeCancelled = ["draft", "in_progress", "review"].includes(detail.status);

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href="/stok-opname"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Daftar Stok Opname
        </Link>
      </div>

      <PageHeader
        title={detail.opname_no}
        description={`Sesi stok opname gudang dibuat pada ${formatDate(detail.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OpnameStatusBadge status={detail.status} />
            <OpnameTypeBadge type={detail.opname_type} />
            {canBeCancelled && canVoid && (
              <VoidOpnameDialog opnameId={detail.id} opnameNo={detail.opname_no} />
            )}
          </div>
        }
      />

      {/* Informasi Header Sesi */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-start gap-2.5">
          <User className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Petugas Penghitung</div>
            <div className="font-medium text-foreground">
              {detail.assigned_name ?? "(Semua Petugas / Belum Ditugaskan)"}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <EyeOff className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Mode Hitung Buta</div>
            <div className="font-medium text-foreground">
              {detail.is_blind_count ? "Aktif (Stok sistem disembunyikan)" : "Nonaktif (Stok terlihat)"}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Calendar className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Waktu Penghitungan</div>
            <div className="font-medium text-foreground">
              {detail.started_at ? formatDateTime(detail.started_at) : "Belum dimulai"}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Persetujuan & Posting</div>
            <div className="font-medium text-foreground">
              {detail.approved_at ? (
                <>
                  {detail.approved_name} ({formatDate(detail.approved_at)})
                </>
              ) : (
                "Belum disetujui"
              )}
            </div>
          </div>
        </div>
      </div>

      {detail.journal_no && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
          <BookOpen className="size-4 shrink-0" />
          <div>
            Jurnal penyesuaian otomatis berhasil dibuat dengan nomor referensi{" "}
            <span className="font-mono font-semibold">{detail.journal_no}</span>.
          </div>
        </div>
      )}

      {detail.status === "void" && detail.void_reason && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          <div className="font-semibold">Sesi Dibatalkan</div>
          <div className="mt-0.5">Alasan: {detail.void_reason}</div>
        </div>
      )}

      {detail.notes && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Catatan Sesi:</span> {detail.notes}
        </div>
      )}

      {/* Konten Berdasarkan Status */}
      {detail.status === "draft" || detail.status === "in_progress" ? (
        <CountSheet detail={detail} canCount={canCount} canApprove={canApprove} />
      ) : (
        <ReviewPanel detail={detail} canApprove={canApprove} canCount={canCount} />
      )}
    </>
  );
}

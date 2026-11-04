"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Maximize2, Minimize2, PackageSearch, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, inputClass, panel } from "@/components/page-kit";
import { formatDate, formatDuration, formatRupiah } from "@/lib/format";
import type { WorkOrderRow } from "@/lib/service";
import { BOARD_STATUSES, WO_STATUS_LABEL } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { WarrantyBadge, WoStatusBadge } from "./ui";

const REFRESH_MS = 30_000;
const norm = (v: string) => v.toLowerCase().replace(/[\s.-]/g, "");

/** Dot warna per status kolom kanban, sesuai Figma */
const COLUMN_COLOR: Record<string, string> = {
  queued: "#475467",
  in_progress: "#1e40af",
  waiting_parts: "#b45309",
  waiting_approval: "#6d28d9",
  quality_check: "#0e7490",
  ready: "#15803d",
};

/** Badge bg per status */
const COLUMN_BADGE: Record<string, string> = {
  queued: "bg-[#f2f4f7] text-[#475467]",
  in_progress: "bg-[#eef2ff] text-[#1e40af]",
  waiting_parts: "bg-[#fffbeb] text-[#b45309]",
  waiting_approval: "bg-[#f5f3ff] text-[#6d28d9]",
  quality_check: "bg-[#ecfeff] text-[#0e7490]",
  ready: "bg-[#ecfdf3] text-[#15803d]",
};

/**
 * Papan status kanban (PRD 7.3): kartu per status dengan nomor polisi, mekanik, lama di status.
 * Kartu lewat estimasi durasi bertanda merah. Perubahan work order masuk langsung lewat Supabase Realtime;
 * polling 30 detik tetap jalan sebagai cadangan bila koneksi realtime putus. Mode layar penuh untuk TV.
 */
export function ServiceBoard({ orders, showMoney, historyFilter, historyTitle = "Selesai & batal 14 hari terakhir" }: { orders: WorkOrderRow[]; showMoney: boolean; historyFilter?: React.ReactNode; historyTitle?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [query, setQuery] = useState("");
  const [live, setLive] = useState(false);

  // Realtime hanya pemicu: ada perubahan di tabel WO, muat ulang data dari server (RLS tetap berlaku).
  // Beberapa perubahan beruntun digabung jadi satu muat ulang.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase.channel("service-board");
    for (const table of ["work_orders", "work_order_items", "work_order_mechanics"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    }
    channel.subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), REFRESH_MS);
    const onFs = () => setFull(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      clearInterval(t);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [router]);

  const shown = useMemo(() => {
    const q = norm(query);
    return orders.filter((o) => !q || [o.plate_no, o.wo_no, o.customer_name ?? "", o.mechanics].some((x) => norm(x).includes(q)));
  }, [orders, query]);
  const active = shown.filter((o) => BOARD_STATUSES.includes(o.status));
  const done = shown.filter((o) => !BOARD_STATUSES.includes(o.status)).reverse();

  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen());

  return (
    <div className="grid gap-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {full ? (
          <h2 className="flex-1 text-2xl font-semibold">Papan Servis</h2>
        ) : (
          <label className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nomor polisi, WO, pelanggan, mekanik..."
              aria-label="Cari work order"
              className={cn(inputClass, "pl-9")}
            />
          </label>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold",
            live ? "bg-[#ecfdf3] text-[#15803d]" : "bg-muted text-muted-foreground",
          )}
          title={live ? "Perubahan tampil langsung" : "Realtime belum tersambung; data disegarkan tiap 30 detik"}
        >
          <span className={cn("size-2 rounded-full", live ? "bg-[#15803d]" : "bg-muted-foreground/50")} />
          {live ? "Langsung" : "Tiap 30 dtk"}
        </span>
        <Button variant="outline" onClick={toggleFull}>
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          {full ? "Keluar layar penuh" : "Layar penuh (TV)"}
        </Button>
      </div>

      {/* Kanban board */}
      <div ref={ref} className={cn(full && "overflow-auto bg-background p-6")}>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {BOARD_STATUSES.map((s) => {
            const cards = active.filter((o) => o.status === s);
            const dotColor = COLUMN_COLOR[s] ?? "#475467";
            const badgeCls = COLUMN_BADGE[s] ?? "bg-muted text-muted-foreground";
            return (
              <section
                key={s}
                aria-label={WO_STATUS_LABEL[s]}
                className="flex w-[175px] shrink-0 flex-col gap-2 rounded-xl bg-[#eef0f3] p-3 dark:bg-muted/40 lg:w-auto"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-0.5 pb-1">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                  <h3 className="flex-1 text-[13px] font-semibold leading-tight">{WO_STATUS_LABEL[s]}</h3>
                  <span className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums", badgeCls)}>
                    {cards.length}
                  </span>
                </div>
                {cards.map((o) => (
                  <Card key={o.id} o={o} readOnly={full} showMoney={showMoney} />
                ))}
              </section>
            );
          })}
        </div>
      </div>

      {historyFilter}
      <section className={cn(panel, "overflow-hidden p-0")}>
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-[15px] font-semibold">{historyTitle}</h2>
        </div>
        {done.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState icon={Clock} text="Belum ada." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left text-xs font-medium text-muted-foreground dark:bg-muted/40">
                  <th className="px-5 py-2.5 font-medium">KENDARAAN</th>
                  <th className="px-3 py-2.5 font-medium">PELANGGAN</th>
                  <th className="px-3 py-2.5 font-medium">LAYANAN</th>
                  <th className="px-3 py-2.5 font-medium">TANGGAL</th>
                  <th className="px-3 py-2.5 font-medium">STATUS</th>
                  {showMoney && <th className="px-5 py-2.5 text-right font-medium">TOTAL</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {done.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <Link href={`/servis/${o.id}`} className="hover:underline">
                        <p className="font-mono text-sm font-semibold">{o.plate_no}</p>
                        <p className="text-xs text-muted-foreground">{o.vehicle_label ?? o.wo_no}</p>
                      </Link>
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-sm text-muted-foreground">
                      {o.customer_name ?? "Umum"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-sm text-muted-foreground">
                      {o.services || o.parts || "-"}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {formatDate(o.delivered_at ?? o.status_changed_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {o.is_warranty && <WarrantyBadge />}
                        <WoStatusBadge status={o.status} />
                      </div>
                    </td>
                    {showMoney && (
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {formatRupiah(o.total)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ o, readOnly, showMoney }: { o: WorkOrderRow; readOnly: boolean; showMoney: boolean }) {
  /** Hitung progress berdasarkan status */
  const progressMap: Record<string, number> = { queued: 0, in_progress: 50, waiting_parts: 40, waiting_approval: 60, quality_check: 90, ready: 100, delivered: 100, void: 0 };
  const colorMap: Record<string, string> = { queued: "#475467", in_progress: "#1e40af", waiting_parts: "#b45309", waiting_approval: "#6d28d9", quality_check: "#15803d", ready: "#15803d", delivered: "#15803d", void: "#ef4444" };
  const progress = progressMap[o.status] ?? 0;
  const progressColor = o.is_overdue ? "#b45309" : (colorMap[o.status] ?? "#1e40af");

  /** Inisial mekanik pertama */
  const initials = o.mechanics ? o.mechanics.split(",")[0].trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() : null;

  const body = (
    <div className="grid gap-2 p-3">
      {/* Top: WO no */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">{o.wo_no}</span>
        {o.is_overdue && (
          <span className="rounded-full bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-medium text-[#b45309]">Lewat est.</span>
        )}
        {o.is_warranty && (
          <span className="rounded-full bg-[#fef2f2] px-1.5 py-0.5 text-[10px] font-medium text-[#dc2626]">Garansi</span>
        )}
      </div>

      {/* Vehicle */}
      <div className="grid gap-0.5">
        <span className="inline-flex w-fit rounded px-1.5 py-0.5 text-[11px] font-semibold bg-[#f9fafb] dark:bg-muted/60">
          {o.plate_no}
        </span>
        <p className={cn("font-semibold leading-snug", readOnly ? "text-lg" : "text-[13px]")}>
          {o.vehicle_label ?? o.plate_no}
        </p>
        {(o.services || o.parts) && (
          <p className="line-clamp-2 text-[12px] text-muted-foreground">{o.services || o.parts}</p>
        )}
      </div>

      {/* Customer */}
      {o.customer_name && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <User className="size-3 shrink-0" />
          <span className="truncate">{o.customer_name}</span>
        </div>
      )}

      {/* Parts pending note */}
      {o.parts_pending > 0 && (
        <div className={cn("rounded-md px-2 py-1.5 text-[11px] font-medium", o.parts_requested > 0 ? "bg-[#fffbeb] text-[#b45309]" : "bg-muted text-muted-foreground")}>
          <PackageSearch className="inline size-3 mr-1" />
          {o.parts_requested > 0 ? `${o.parts_requested} part diminta` : `${o.parts_pending} part belum keluar`}
        </div>
      )}

      {/* Progress bar (hanya jika in_progress) */}
      {o.status === "in_progress" && (
        <div className="flex items-center gap-2">
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#eaecf0] dark:bg-muted">
            <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">{progress}%</span>
        </div>
      )}

      {/* Price note (Siap Diambil) */}
      {o.status === "ready" && showMoney && o.total > 0 && (
        <div className="rounded-md bg-[#ecfdf3] px-2 py-1.5 dark:bg-emerald-950/40">
          <p className="text-[11px] font-semibold text-[#15803d] dark:text-emerald-400">{formatRupiah(o.total)}</p>
          <p className="text-[11px] font-medium text-muted-foreground">Siap ditagih</p>
        </div>
      )}

      {/* Footer: mekanik + durasi */}
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
        {initials ? (
          <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#dbe4ff] text-[10px] font-semibold text-[#1e40af]">
            {initials}
          </span>
        ) : (
          <span className="rounded-md border border-dashed border-[#1e40af]/40 px-2 py-0.5 text-[10px] font-semibold text-[#1e40af]">
            Tugaskan
          </span>
        )}
        <span className={cn("flex shrink-0 items-center gap-1 tabular-nums", o.is_overdue && "font-semibold text-brand-red")}>
          <Clock className="size-3" />
          {formatDuration(o.minutes_in_status)}
        </span>
      </div>
    </div>
  );

  const cls = cn(
    "rounded-[10px] border bg-white dark:bg-card shadow-sm transition-colors",
    o.is_overdue ? "border-[#b45309]/50" : "border-border",
  );

  if (readOnly) return <div className={cls}>{body}</div>;
  return (
    <Link href={`/servis/${o.id}`} className={cn(cls, "hover:border-brand-blue hover:shadow-md")}>
      {body}
    </Link>
  );
}

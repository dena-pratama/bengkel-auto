"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Maximize2, Minimize2, PackageSearch, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, inputClass, panel } from "@/components/page-kit";
import { formatDate, formatDuration, formatRupiah } from "@/lib/format";
import type { WorkOrderRow } from "@/lib/service";
import { BOARD_STATUSES, WO_STATUS_LABEL } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { WarrantyBadge, WoStatusBadge } from "./ui";

const REFRESH_MS = 30_000;
const norm = (v: string) => v.toLowerCase().replace(/[\s.-]/g, "");

/**
 * Papan status kanban (PRD §7.3): kartu per status dengan nomor polisi, mekanik, lama di status.
 * Kartu lewat estimasi durasi bertanda merah. Data diperbarui tiap 30 detik; mode layar penuh untuk TV.
 */
export function ServiceBoard({ orders, showMoney }: { orders: WorkOrderRow[]; showMoney: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [query, setQuery] = useState("");

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
      <div ref={ref} className={cn("grid gap-3", full && "overflow-auto bg-background p-6")}>
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
                placeholder="Cari nomor polisi, WO, pelanggan, mekanik…"
                aria-label="Cari work order"
                className={cn(inputClass, "pl-9")}
              />
            </label>
          )}
          <Button variant="outline" onClick={toggleFull}>
            {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {full ? "Keluar layar penuh" : "Layar penuh (TV)"}
          </Button>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {BOARD_STATUSES.map((s) => {
            const cards = active.filter((o) => o.status === s);
            return (
              <section key={s} aria-label={WO_STATUS_LABEL[s]} className="flex w-64 shrink-0 flex-col gap-2 rounded-md bg-muted/50 p-2 lg:w-auto">
                <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
                  {WO_STATUS_LABEL[s]}
                  <span className="rounded-sm bg-card px-1.5 text-xs text-muted-foreground tabular-nums">{cards.length}</span>
                </h3>
                {cards.map((o) => (
                  <Card key={o.id} o={o} readOnly={full} />
                ))}
              </section>
            );
          })}
        </div>
      </div>

      <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
        <h2 className="text-lg font-semibold">Selesai & batal 14 hari terakhir</h2>
        {done.length === 0 ? (
          <EmptyState icon={Clock} text="Belum ada." />
        ) : (
          <ul className="grid divide-y divide-border">
            {done.map((o) => (
              <li key={o.id}>
                <Link href={`/servis/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-muted/40 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">
                      {o.plate_no} <span className="font-normal text-muted-foreground">· {o.wo_no}</span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[o.customer_name, o.services || o.parts].filter(Boolean).join(" · ")} · {formatDate(o.delivered_at ?? o.status_changed_at)}
                    </p>
                  </div>
                  {o.is_warranty && <WarrantyBadge />}
                  <WoStatusBadge status={o.status} />
                  {showMoney && <span className="w-28 text-right font-semibold tabular-nums">{formatRupiah(o.total)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ o, readOnly }: { o: WorkOrderRow; readOnly: boolean }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("font-mono font-bold", readOnly ? "text-xl" : "text-base")}>{o.plate_no}</p>
        {o.is_overdue && <AlertTriangle className="size-4 shrink-0 text-brand-red" aria-label="Lewat estimasi durasi" />}
      </div>
      <p className="truncate text-xs text-muted-foreground">{o.vehicle_label ?? o.wo_no}</p>
      {(o.services || o.parts) && <p className="line-clamp-2 text-xs">{o.services || o.parts}</p>}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {o.is_warranty && <WarrantyBadge />}
        {o.parts_pending > 0 && (
          <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5", o.parts_requested > 0 ? "bg-brand-sand text-foreground" : "bg-muted text-muted-foreground")}>
            <PackageSearch className="size-3" />
            {o.parts_requested > 0 ? `${o.parts_requested} part diminta` : `${o.parts_pending} part belum keluar`}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <User className="size-3 shrink-0" />
          {o.mechanics || "Belum ada mekanik"}
        </span>
        <span className={cn("flex shrink-0 items-center gap-1 tabular-nums", o.is_overdue && "font-semibold text-brand-red")}>
          <Clock className="size-3" />
          {formatDuration(o.minutes_in_status)}
        </span>
      </div>
    </>
  );
  const cls = cn("grid gap-1.5 rounded-sm border bg-card p-2.5 shadow-sm", o.is_overdue ? "border-brand-red ring-1 ring-brand-red" : "border-border");
  if (readOnly) return <div className={cls}>{body}</div>;
  return (
    <Link href={`/servis/${o.id}`} className={cn(cls, "transition-colors hover:border-brand-blue")}>
      {body}
    </Link>
  );
}

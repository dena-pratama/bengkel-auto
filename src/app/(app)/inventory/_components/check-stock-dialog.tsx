"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, MapPin, Package, QrCode, RotateCcw, ScanLine, Search } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { inputClass, panel } from "@/components/page-kit";
import { ScanButton } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import { parseQr } from "@/lib/qr";
import type { ScanItem, ScanLocation, ScanResult } from "@/lib/scan";
import { cn } from "@/lib/utils";
import { checkStockAction } from "../actions";

export function CheckStockDialog({
  trigger,
}: {
  trigger?: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCode("");
      setResult(null);
      setError(null);
    }
  };

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const search = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await checkStockAction(trimmed);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res.data);
    });
  };

  const reset = () => {
    setCode("");
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <>
      {trigger ? (
        trigger(() => handleOpenChange(true))
      ) : (
        <Button variant="outline" onClick={() => handleOpenChange(true)}>
          <QrCode className="size-4" /> Cek stok
        </Button>
      )}
      <FormDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Cek Stok & Lokasi Rak"
        description="Scan QR barang atau ketik SKU / kode rak untuk melihat stok fisik dan lokasi rak secara langsung."
        size="lg"
      >
        <div className="grid gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(code);
            }}
            className="flex flex-wrap gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Scan barcode/QR USB, atau ketik SKU (mis. OLI-5W30)"
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                className={cn(inputClass, "pl-9 font-mono")}
              />
            </div>
            <Button type="submit" disabled={pending || !code.trim()}>
              {pending ? "Memeriksa..." : "Cek Stok"}
            </Button>
            <ScanButton
              label="Scan kamera"
              className="h-10 rounded-lg"
              onScan={(t) => {
                const parsed = parseQr(t);
                const codeToSearch = parsed?.code ?? t;
                setCode(codeToSearch);
                search(codeToSearch);
              }}
            />
          </form>

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-brand-red-soft p-3.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {pending && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <ScanLine className="size-8 animate-pulse text-brand-blue" />
              <p className="text-sm">Memuat data stok & rak...</p>
            </div>
          )}

          {!pending && !result && !error && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Package className="size-10 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="text-sm font-medium">Belum ada barang yang dicek</p>
              <p className="text-xs text-muted-foreground">Arahkan pemindai barcode USB ke label barang, atau ketik SKU di atas lalu tekan Enter.</p>
            </div>
          )}

          {!pending && result && (
            <div className="grid gap-3">
              {result.kind === "notfound" && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 py-8 text-center text-muted-foreground">
                  <AlertCircle className="size-8 text-brand-sand" />
                  <p className="text-sm font-semibold text-foreground">Barang atau rak tidak ditemukan</p>
                  <p className="text-xs">Kode &quot;{result.code}&quot; tidak terdaftar dalam database master barang maupun lokasi rak.</p>
                </div>
              )}

              {result.kind === "invalid" && (
                <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-brand-red-soft p-3.5 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>Format QR tidak dikenali. Gunakan QR label barang atau rak resmi bengkel.</span>
                </div>
              )}

              {result.kind === "item" && <ItemStockView item={result} />}

              {result.kind === "location" && <LocationStockView location={result} />}

              <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                <Button type="button" variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" /> Cek barang lain
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </div>
      </FormDialog>
    </>
  );
}

function ItemStockView({ item }: { item: ScanItem }) {
  const isLow = item.min_stock > 0 && item.total_qty <= item.min_stock;
  return (
    <div className="grid gap-3">
      {/* Header Info */}
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-muted-foreground">{item.sku}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold",
                isLow ? "bg-brand-red-soft text-brand-red" : "bg-brand-green-soft text-brand-green",
              )}
            >
              {isLow ? <AlertCircle className="size-3" /> : <CheckCircle2 className="size-3" />}
              {isLow ? "Stok Menipis" : "Stok Aman"}
            </span>
          </div>
          <h3 className="mt-1 text-base font-semibold text-foreground">{item.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-2xs text-muted-foreground uppercase tracking-wider">Harga Jual</p>
          <p className="text-lg font-bold text-foreground tabular-nums">{formatRupiah(item.sell_price)}</p>
        </div>
      </div>

      {/* Ringkasan Stok & Lokasi */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={cn(panel, "p-3.5")}>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Total Stok Fisik</p>
          <p className={cn("mt-1 text-2xl font-bold tabular-nums", isLow ? "text-brand-red" : "text-foreground")}>
            {formatQty(item.total_qty)} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Batas minimum: {formatQty(item.min_stock)} {item.unit}</p>
        </div>

        <div className={cn(panel, "p-3.5")}>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Lokasi Rak ({item.locations.length})</p>
          {item.locations.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Belum ditempatkan di rak.</p>
          ) : (
            <ul className="mt-1.5 grid gap-1.5">
              {item.locations.map((loc) => (
                <li key={loc.location_id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {loc.code} ({loc.name})
                  </span>
                  <span className="font-semibold tabular-nums text-foreground">{formatQty(loc.qty)} {item.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Mutasi Terakhir */}
      {item.movements.length > 0 && (
        <div className="rounded-xl border border-border p-3.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Riwayat Mutasi Terakhir</p>
          <ul className="mt-2 divide-y divide-border text-xs">
            {item.movements.slice(0, 4).map((m) => (
              <li key={m.id} className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">{formatDateTime(m.created_at)}</span>
                <span className="font-medium text-foreground">{m.movement_type} ({m.location_code})</span>
                <span className="font-mono font-semibold tabular-nums text-foreground">{m.qty > 0 ? `+${formatQty(m.qty)}` : formatQty(m.qty)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LocationStockView({ location }: { location: ScanLocation }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div>
          <span className="font-mono text-xs font-semibold text-brand-blue-fg">{location.code}</span>
          <h3 className="text-base font-semibold text-foreground">{location.name}</h3>
        </div>
        <span className="rounded-full bg-brand-blue-soft px-2.5 py-1 text-2xs font-semibold text-brand-blue-fg">
          Lokasi Rak ({location.items.length} jenis barang)
        </span>
      </div>

      <div className="rounded-xl border border-border p-3.5">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Daftar Barang di Rak Ini</p>
        {location.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Rak ini saat ini kosong.</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {location.items.map((it) => (
              <li key={it.item_id} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{it.name}</p>
                  <p className="font-mono text-2xs text-muted-foreground">{it.sku}</p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatQty(it.qty)} {it.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

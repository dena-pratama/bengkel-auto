"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightLeft, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import type { Location, StockBalance, StockMovement } from "@/lib/inventory";
import { formatDateTime, formatQty, formatRupiah } from "@/lib/format";
import {
  MOVEMENT_LABEL,
  openingStockSchema,
  transferSchema,
  type OpeningStockInput,
  type TransferInput,
} from "@/lib/validation/inventory";
import { cn } from "@/lib/utils";
import { postOpeningStockAction, transferStockAction } from "../actions";

type Mode = "opening" | "transfer" | null;

function LocationSelect({ id, label, locations, error, ...props }: React.ComponentProps<"select"> & { label: string; locations: Location[]; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} className={inputClass} aria-invalid={Boolean(error)} {...props}>
        <option value="">— Pilih lokasi —</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.path} · {l.name}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function StockPanel({
  itemId,
  unit,
  minStock,
  defaultLocationId,
  balances,
  movements,
  locations,
  avgCost,
  canOpening,
  canTransfer,
}: {
  itemId: string;
  unit: string;
  minStock: number;
  defaultLocationId: string | null;
  balances: StockBalance[];
  movements: StockMovement[];
  locations: Location[];
  avgCost: number | null;
  canOpening: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const loc = new Map(locations.map((l) => [l.id, l]));
  const total = balances.reduce((s, b) => s + b.qty, 0);
  const activeLocations = locations.filter((l) => l.is_active);
  const stocked = locations.filter((l) => balances.some((b) => b.location_id === l.id && b.qty > 0));

  const opening = useForm<OpeningStockInput>({
    resolver: zodResolver(openingStockSchema),
    defaultValues: { location_id: defaultLocationId ?? "", qty: "", unit_cost: "", note: "" },
  });
  const transfer = useForm<TransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: { from: stocked[0]?.id ?? "", to: "", qty: "", note: "" },
  });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return setMessage({ ok: false, text: (r as { error: string }).error });
      setMessage({ ok: true, text: success });
      after();
      setMode(null);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <section className={cn(panel, "grid gap-4")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Total stok</p>
            <p className={cn("text-3xl font-bold tabular-nums", minStock > 0 && total <= minStock && "text-brand-red")}>
              {formatQty(total)} <span className="text-base font-medium text-muted-foreground">{unit}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Minimum {formatQty(minStock)} {unit}
              {avgCost !== null && ` · HPP rata-rata ${formatRupiah(avgCost)}/${unit}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canTransfer && stocked.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setMode(mode === "transfer" ? null : "transfer")}>
                <ArrowRightLeft className="size-4" /> Pindah lokasi
              </Button>
            )}
            {canOpening && (
              <Button variant="outline" size="sm" onClick={() => setMode(mode === "opening" ? null : "opening")}>
                <PackagePlus className="size-4" /> Saldo awal
              </Button>
            )}
          </div>
        </div>

        {mode === "opening" && (
          <form
            noValidate
            className="grid gap-3 rounded-sm border border-border p-3 sm:grid-cols-2"
            onSubmit={opening.handleSubmit((v) =>
              run(() => postOpeningStockAction(itemId, v), "Saldo awal tersimpan.", () => opening.reset({ ...v, qty: "", unit_cost: "", note: "" })),
            )}
          >
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Untuk stok yang sudah ada saat mulai memakai aplikasi. Penambahan stok berikutnya lewat modul Pembelian.
            </p>
            <LocationSelect id="op_location" label="Lokasi" locations={activeLocations} error={opening.formState.errors.location_id?.message} {...opening.register("location_id")} />
            <FormField id="op_qty" label={`Jumlah (${unit})`} inputMode="decimal" error={opening.formState.errors.qty?.message} {...opening.register("qty")} />
            <FormField
              id="op_cost"
              label={`Harga pokok per ${unit} (Rp)`}
              inputMode="numeric"
              error={opening.formState.errors.unit_cost?.message}
              {...opening.register("unit_cost")}
            />
            <FormField id="op_note" label="Catatan" placeholder="Saldo awal" {...opening.register("note")} />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan..." : "Simpan saldo awal"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Batal
              </Button>
            </div>
          </form>
        )}

        {mode === "transfer" && (
          <form
            noValidate
            className="grid gap-3 rounded-sm border border-border p-3 sm:grid-cols-2"
            onSubmit={transfer.handleSubmit((v) => run(() => transferStockAction(itemId, v), "Stok dipindahkan.", () => transfer.reset({ ...v, qty: "", note: "" })))}
          >
            <LocationSelect id="tr_from" label="Dari" locations={stocked} error={transfer.formState.errors.from?.message} {...transfer.register("from")} />
            <LocationSelect id="tr_to" label="Ke" locations={activeLocations} error={transfer.formState.errors.to?.message} {...transfer.register("to")} />
            <FormField id="tr_qty" label={`Jumlah (${unit})`} inputMode="decimal" error={transfer.formState.errors.qty?.message} {...transfer.register("qty")} />
            <FormField id="tr_note" label="Catatan" placeholder="mis. Rak penuh" {...transfer.register("note")} />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Memindahkan..." : "Pindahkan"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Batal
              </Button>
            </div>
          </form>
        )}
        {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}

        <div>
          <h3 className="mb-2 text-sm font-semibold">Stok per lokasi</h3>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada stok.</p>
          ) : (
            <ul className="grid gap-1.5">
              {balances
                .map((b) => ({ ...b, l: loc.get(b.location_id) }))
                .sort((a, b) => (a.l?.path ?? "").localeCompare(b.l?.path ?? ""))
                .map((b) => (
                  <li key={b.location_id} className="flex items-center justify-between gap-3 rounded-sm bg-muted/60 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-mono font-medium">{b.l?.path}</span>
                      <span className="text-muted-foreground"> · {b.l?.name}</span>
                    </span>
                    <span className={cn("shrink-0 font-semibold tabular-nums", b.qty < 0 && "text-brand-red")}>
                      {formatQty(b.qty)} {unit}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <h3 className="text-lg font-semibold">Mutasi stok terakhir</h3>
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada mutasi.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {movements.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{loc.get(m.location_id)?.path}</span>
                    {m.note && ` · ${m.note}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</p>
                </div>
                <span className={cn("shrink-0 text-sm font-semibold tabular-nums", m.qty > 0 ? "text-brand-blue-fg" : "text-brand-red")}>
                  {m.qty > 0 ? "+" : ""}
                  {formatQty(m.qty)} {unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

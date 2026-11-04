"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import type { StockOpnameDetail } from "@/lib/stock-opname";
import { completeOpnameCountAction, saveOpnameCountsAction, startStockOpnameAction } from "../actions";
import { formatQty } from "./ui";

export function CountSheet({
  detail,
  canCount,
  canApprove,
}: {
  detail: StockOpnameDetail;
  canCount: boolean;
  canApprove: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Inisialisasi state hitungan fisik dari detail.items
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const item of detail.items) {
      if (item.physical_qty !== null && item.physical_qty !== undefined) {
        init[item.id] = String(item.physical_qty);
      }
    }
    return init;
  });

  // Kumpulan lokasi rak yang ada pada sesi opname ini
  const locations = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of detail.items) {
      map.set(item.location_id, item.location_code);
    }
    return Array.from(map.entries()).map(([id, code]) => ({ id, code }));
  }, [detail.items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return detail.items.filter((item) => {
      if (selectedLocation !== "all" && item.location_id !== selectedLocation) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const sku = item.item_sku.toLowerCase();
        const name = item.item_name.toLowerCase();
        if (!sku.includes(q) && !name.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [detail.items, selectedLocation, search]);

  const totalItemsCount = detail.items.length;
  const countedItemsCount = Object.keys(physicalCounts).filter(
    (k) => physicalCounts[k] !== undefined && physicalCounts[k] !== "",
  ).length;

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      const res = await startStockOpnameAction(detail.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Sesi opname dimulai. Silakan input hitungan fisik di rak.");
    });
  };

  const handleSaveProgress = () => {
    setError(null);
    const countsPayload = detail.items
      .filter((it) => physicalCounts[it.id] !== undefined && physicalCounts[it.id] !== "")
      .map((it) => ({
        item_id: it.item_id,
        location_id: it.location_id,
        physical_qty: parseFloat(physicalCounts[it.id]),
        variance_reason: it.variance_reason,
        notes: it.notes ?? undefined,
      }));

    if (countsPayload.length === 0) {
      setError("Belum ada angka hitungan fisik yang diinput.");
      return;
    }

    startTransition(async () => {
      const res = await saveOpnameCountsAction({
        opname_id: detail.id,
        counts: countsPayload,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      toast.success("Hitungan fisik berhasil disimpan.");
    });
  };

  const handleCompleteCount = () => {
    setError(null);
    const uncounted = detail.items.filter(
      (it) => physicalCounts[it.id] === undefined || physicalCounts[it.id] === "",
    );

    if (uncounted.length > 0) {
      setError(`Masih ada ${uncounted.length} barang yang belum diinput hitungan fisiknya.`);
      return;
    }

    startTransition(async () => {
      // Simpan hitungan dulu sebelum menyelesaikan
      const countsPayload = detail.items.map((it) => ({
        item_id: it.item_id,
        location_id: it.location_id,
        physical_qty: parseFloat(physicalCounts[it.id]),
        variance_reason: it.variance_reason,
        notes: it.notes ?? undefined,
      }));

      const saveRes = await saveOpnameCountsAction({
        opname_id: detail.id,
        counts: countsPayload,
      });

      if (!saveRes.ok) {
        setError(saveRes.error);
        return;
      }

      const compRes = await completeOpnameCountAction(detail.id);
      if (!compRes.ok) {
        setError(compRes.error);
        return;
      }

      toast.success("Penghitungan selesai. Silakan periksa tinjauan selisih.");
    });
  };

  const showSystemQty = !detail.is_blind_count || canApprove;

  return (
    <div className="grid gap-4">
      {error && <FormError message={error} />}

      {detail.status === "draft" && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row dark:border-amber-900/50 dark:bg-amber-950/20">
          <div>
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Sesi Masih Berstatus Draft
            </div>
            <div className="text-xs text-amber-800 dark:text-amber-300">
              Mulai sesi untuk membekukan saldo stok sistem saat ini dan mulai input hitungan fisik.
            </div>
          </div>
          {canCount && (
            <Button onClick={handleStart} disabled={pending} className="gap-1.5 shrink-0">
              <Play className="size-4" />
              Mulai Penghitungan
            </Button>
          )}
        </div>
      )}

      {/* Progress hitung & toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Progres Penghitungan Fisik</div>
          <div className="text-lg font-bold">
            {countedItemsCount} dari {totalItemsCount} Barang ({Math.round((countedItemsCount / (totalItemsCount || 1)) * 100)}%)
          </div>
        </div>

        {canCount && detail.status === "in_progress" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveProgress}
              disabled={pending}
              className="gap-1.5"
            >
              <Save className="size-4" />
              Simpan Progres
            </Button>
            <Button
              size="sm"
              onClick={handleCompleteCount}
              disabled={pending}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              Selesaikan Hitung Fisik
            </Button>
          </div>
        )}
      </div>

      {/* Filter Rak & Pencarian */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 overflow-x-auto border-b border-border pb-1">
          <button
            type="button"
            onClick={() => setSelectedLocation("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedLocation === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            Semua Rak ({detail.items.length})
          </button>
          {locations.map((loc) => {
            const count = detail.items.filter((it) => it.location_id === loc.id).length;
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => setSelectedLocation(loc.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedLocation === loc.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {loc.code} ({count})
              </button>
            );
          })}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value.replace(/^I:/i, ""))}
            placeholder="Cari SKU atau nama barang (atau scan QR)..."
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Tabel Input Hitung */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Lokasi Rak</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3">Satuan</th>
              {showSystemQty && <th className="px-4 py-3 text-right">Stok Sistem</th>}
              <th className="px-4 py-3 text-right w-44">Jumlah Fisik</th>
              <th className="px-4 py-3 text-center">Status Hitung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={showSystemQty ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada barang yang cocok dengan filter rak atau pencarian.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const val = physicalCounts[item.id] ?? "";
                const isCounted = val !== "";

                return (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium">
                      <span className="inline-flex rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono">
                        {item.location_code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {item.item_sku}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {item.item_name}
                      {item.category_name && (
                        <span className="ml-2 text-xs text-muted-foreground">({item.category_name})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {item.unit_code}
                    </td>
                    {showSystemQty && (
                      <td className="px-4 py-2.5 text-right font-mono font-medium">
                        {formatQty(item.system_qty)}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right">
                      {detail.status === "in_progress" && canCount ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={val}
                            onChange={(e) =>
                              setPhysicalCounts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder="Isi fisik..."
                            className="w-24 rounded border border-border bg-background px-2.5 py-1 text-right font-mono text-sm outline-none focus:border-primary"
                          />
                          {showSystemQty && (
                            <button
                              type="button"
                              title="Salin sama dengan sistem"
                              onClick={() =>
                                setPhysicalCounts((prev) => ({
                                  ...prev,
                                  [item.id]: String(item.system_qty),
                                }))
                              }
                              className="rounded border border-border p-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <Check className="size-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono font-semibold">
                          {isCounted ? formatQty(parseFloat(val)) : <span className="text-muted-foreground">-</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isCounted ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Check className="size-3" />
                          Sudah
                        </span>
                      ) : (
                        <span className="inline-flex rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Belum
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

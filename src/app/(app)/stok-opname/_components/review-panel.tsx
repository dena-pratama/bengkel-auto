"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import type { StockOpnameDetail } from "@/lib/stock-opname";
import {
  VARIANCE_REASONS,
  VARIANCE_REASON_LABEL,
  type VarianceReason,
} from "@/lib/validation/stock-opname";
import { postStockOpnameAction, recountOpnameItemAction } from "../actions";
import { formatQty, formatRp } from "./ui";

export function ReviewPanel({
  detail,
  canApprove,
  canCount,
}: {
  detail: StockOpnameDetail;
  canApprove: boolean;
  canCount: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [filterVarianceOnly, setFilterVarianceOnly] = useState(false);

  // State alasan selisih per baris
  const [reasons, setReasons] = useState<Record<string, { reason: VarianceReason | ""; notes: string }>>(() => {
    const init: Record<string, { reason: VarianceReason | ""; notes: string }> = {};
    for (const item of detail.items) {
      init[item.id] = {
        reason: item.variance_reason ?? "",
        notes: item.notes ?? "",
      };
    }
    return init;
  });

  const varianceItems = useMemo(
    () => detail.items.filter((it) => it.difference_qty !== 0),
    [detail.items],
  );

  const displayItems = useMemo(() => {
    if (filterVarianceOnly) return varianceItems;
    return detail.items;
  }, [detail.items, varianceItems, filterVarianceOnly]);

  // Validasi apakah semua item berselisih sudah punya alasan
  const missingReasonsCount = useMemo(() => {
    return varianceItems.filter((it) => !reasons[it.id]?.reason).length;
  }, [varianceItems, reasons]);

  const handleRecount = (itemRowId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await recountOpnameItemAction(detail.id, itemRowId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Barang diset untuk dihitung ulang. Status kembali ke Sedang Dihitung.");
      router.refresh();
    });
  };

  const handleApprove = () => {
    setError(null);

    if (missingReasonsCount > 0) {
      setError(`Wajib memilih alasan selisih untuk ${missingReasonsCount} barang yang berselisih.`);
      return;
    }

    startTransition(async () => {
      const reasonsPayload = varianceItems.map((it) => ({
        id: it.id,
        variance_reason: (reasons[it.id]?.reason || "other") as VarianceReason,
        notes: reasons[it.id]?.notes?.trim() || undefined,
      }));

      const res = await postStockOpnameAction({
        opname_id: detail.id,
        pin: pin.trim() || undefined,
        items_reasons: reasonsPayload,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      toast.success("Stok opname berhasil disetujui dan mutasi stok serta jurnal telah diposting!");
      router.refresh();
    });
  };

  const needsPin = Math.abs(detail.total_variance_amount) > 500000;

  return (
    <div className="grid gap-5">
      {error && <FormError message={error} />}

      {/* Ringkasan Statistik Review */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total Barang Dihitung</div>
          <div className="text-xl font-bold font-mono mt-1">{detail.total_items}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Barang Cocok (Selisih 0)</div>
          <div className="text-xl font-bold font-mono mt-1 text-emerald-600 dark:text-emerald-400">
            {detail.matched_items}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Barang Berselisih</div>
          <div className="text-xl font-bold font-mono mt-1 text-rose-600 dark:text-rose-400">
            {detail.variance_items}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total Nilai Selisih</div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              detail.total_variance_amount < 0
                ? "text-rose-600 dark:text-rose-400"
                : detail.total_variance_amount > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-foreground"
            }`}
          >
            {formatRp(detail.total_variance_amount)}
          </div>
        </div>
      </div>

      {/* Filter Tampilan */}
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={filterVarianceOnly}
            onChange={(e) => setFilterVarianceOnly(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Tampilkan hanya barang berselisih ({varianceItems.length})
        </label>
      </div>

      {/* Tabel Tinjauan Barang */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Rak</th>
              <th className="px-4 py-3">Barang</th>
              <th className="px-4 py-3 text-right">Sistem</th>
              <th className="px-4 py-3 text-right">Fisik</th>
              <th className="px-4 py-3 text-right">Selisih</th>
              <th className="px-4 py-3 text-right">HPP</th>
              <th className="px-4 py-3 text-right">Nilai Selisih</th>
              {detail.status === "review" && (
                <>
                  <th className="px-4 py-3 w-48">Alasan Selisih</th>
                  <th className="px-4 py-3 w-40">Catatan</th>
                  {canCount && <th className="px-4 py-3 text-center">Aksi</th>}
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Tidak ada barang yang berselisih. Semua stok cocok sempurna.
                </td>
              </tr>
            ) : (
              displayItems.map((item) => {
                const hasDiff = item.difference_qty !== 0;
                const rowState = reasons[item.id] ?? { reason: "", notes: "" };

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      hasDiff
                        ? item.difference_qty < 0
                          ? "bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
                          : "bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-medium">
                      {item.location_code}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{item.item_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{item.item_sku}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {formatQty(item.system_qty)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-medium">
                      {item.physical_qty !== null ? formatQty(item.physical_qty) : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {hasDiff ? (
                        <span className={item.difference_qty < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {item.difference_qty > 0 ? `+${formatQty(item.difference_qty)}` : formatQty(item.difference_qty)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted-foreground">
                      {formatRp(item.cost_price)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {item.difference_amount !== 0 ? (
                        <span className={item.difference_amount < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                          {formatRp(item.difference_amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Rp 0</span>
                      )}
                    </td>

                    {detail.status === "review" && (
                      <>
                        <td className="px-4 py-2.5">
                          {hasDiff ? (
                            <select
                              value={rowState.reason}
                              onChange={(e) =>
                                setReasons((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    reason: e.target.value as VarianceReason,
                                  },
                                }))
                              }
                              disabled={pending || !canApprove}
                              className={`w-full rounded border px-2 py-1 text-xs outline-none ${
                                !rowState.reason ? "border-rose-400 bg-rose-50/80 dark:bg-rose-950/40" : "border-border bg-background"
                              }`}
                            >
                              <option value="">(Wajib Pilih Alasan)</option>
                              {VARIANCE_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {VARIANCE_REASON_LABEL[r]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-muted-foreground">Cocok</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {hasDiff ? (
                            <input
                              type="text"
                              value={rowState.notes}
                              onChange={(e) =>
                                setReasons((prev) => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    notes: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Keterangan..."
                              disabled={pending || !canApprove}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        {canCount && (
                          <td className="px-4 py-2.5 text-center">
                            {hasDiff && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRecount(item.id)}
                                disabled={pending}
                                title="Hitung Ulang"
                                className="h-7 gap-1 px-2 text-xs"
                              >
                                <RotateCcw className="size-3" />
                                Ulang
                              </Button>
                            )}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Persetujuan & Posting Penyesuaian */}
      {detail.status === "review" && canApprove && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Persetujuan & Posting Penyesuaian
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Menyetujui sesi ini akan otomatis membuat mutasi penyesuaian stok di gudang dan mencatat jurnal pembalik/selisih persediaan di buku besar.
          </p>

          {missingReasonsCount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="size-4 shrink-0" />
              Ada {missingReasonsCount} barang berselisih yang belum memiliki alasan. Pilih alasan selisih pada tabel sebelum menyetujui.
            </div>
          )}

          {needsPin && (
            <div className="mt-4 max-w-xs space-y-1.5">
              <label className="text-sm font-medium">
                PIN Persetujuan Owner <span className="text-destructive">*</span>
              </label>
              <input
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="6 digit PIN..."
                className={inputClass}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Total nilai selisih melebihi ambang toleransi Rp 500.000</p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button
              onClick={handleApprove}
              disabled={pending || missingReasonsCount > 0}
              className="gap-2"
            >
              <CheckCircle2 className="size-4" />
              {pending ? "Memproses Posting..." : "Setujui & Posting Penyesuaian"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

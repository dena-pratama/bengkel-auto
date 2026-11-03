"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError, FormField } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { formatQty, formatRupiah } from "@/lib/format";
import type { ReturnLocation, SaleLine } from "@/lib/cashier";
import {
  CONDITIONS,
  CONDITION_LABEL,
  SETTLEMENTS,
  SETTLEMENT_LABEL,
  type ReturnCondition,
  type ReturnSettlement,
  type SaleReturnInput,
} from "@/lib/validation/cashier";
import { postSaleReturnAction } from "../actions";

export function ReturnDialog({
  saleId,
  saleNo,
  items,
  locations,
  cashAccounts,
  shiftOpen,
  outstanding,
  customerName,
  today,
}: {
  saleId: string;
  saleNo: string;
  items: SaleLine[];
  locations: ReturnLocation[];
  cashAccounts: { id: string; name: string }[];
  shiftOpen: boolean;
  outstanding: number;
  customerName: string | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Hanya baris part yang masih memiliki sisa bisa diretur
  const returnable = items.filter((l) => l.line_type === "part" && l.qty - l.returned_qty > 0);

  const [returnDate, setReturnDate] = useState(today);
  const [settlement, setSettlement] = useState<ReturnSettlement>(outstanding > 0 && customerName ? "debt" : "refund");
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [cashAccountId, setCashAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");

  type ItemState = {
    sale_item_id: string;
    qty: string;
    condition: ReturnCondition;
    location_id: string;
  };

  const defaultQuarantine = locations.find((l) => l.code === "KRT-01")?.id ?? locations[0]?.id ?? "";
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(
      returnable.map((i) => [
        i.id,
        {
          sale_item_id: i.id,
          qty: "",
          condition: "good",
          location_id: i.location_id ?? locations[0]?.id ?? "",
        },
      ]),
    ),
  );

  if (returnable.length === 0) return null;

  const updateItem = (id: string, patch: Partial<ItemState>) => {
    setItemStates((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      const next = { ...cur, ...patch };
      // Jika kondisi diubah jadi rusak, otomatis sarankan rak karantina
      if (patch.condition === "damaged" && defaultQuarantine) {
        next.location_id = defaultQuarantine;
      }
      return { ...prev, [id]: next };
    });
  };

  const activeItems = Object.values(itemStates).filter((s) => Number(s.qty) > 0);

  const estimatedTotal = activeItems.reduce((acc, cur) => {
    const orig = returnable.find((r) => r.id === cur.sale_item_id);
    if (!orig || orig.qty <= 0) return acc;
    const q = Number(cur.qty);
    const unitNet = orig.line_total / orig.qty;
    return acc + q * unitNet;
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (activeItems.length === 0) {
      setError("Pilih minimal satu barang dan isi jumlah retur.");
      return;
    }

    if (reason.trim().length < 3) {
      setError("Alasan retur minimal 3 karakter.");
      return;
    }

    if (settlement === "refund" && payMethod === "cash" && !shiftOpen) {
      setError("Shift kasir belum terbuka untuk pengembalian uang tunai. Buka shift kasir terlebih dahulu atau pilih metode transfer.");
      return;
    }

    const payload: SaleReturnInput = {
      return_date: returnDate,
      settlement,
      payment_method: settlement === "refund" ? payMethod : undefined,
      cash_bank_account_id: settlement === "refund" && payMethod !== "cash" ? cashAccountId : undefined,
      reason: reason.trim(),
      pin: pin.trim(),
      items: activeItems.map((i) => ({
        sale_item_id: i.sale_item_id,
        qty: i.qty,
        condition: i.condition,
        location_id: i.location_id || undefined,
      })),
    };

    startTransition(async () => {
      const res = await postSaleReturnAction(saleId, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success("Retur penjualan berhasil diposting.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Undo2 className="size-4" /> Retur penjualan
      </Button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={`Retur Penjualan ${saleNo}`}
        description="Barang kondisi baik kembali ke stok rak; barang rusak masuk ke rak karantina."
        size="lg"
      >
        <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-4 sm:px-7">
          {error && (
            <div className="mb-4">
              <FormError message={error} />
            </div>
          )}

          <div className="grid gap-4">
            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-2 text-sm font-semibold">Daftar Sparepart yang Bisa Diretur</h3>
              <div className="divide-y divide-border">
                {returnable.map((item) => {
                  const state = itemStates[item.id] ?? {
                    sale_item_id: item.id,
                    qty: "",
                    condition: "good",
                    location_id: item.location_id ?? locations[0]?.id ?? "",
                  };
                  const remaining = item.qty - item.returned_qty;

                  return (
                    <div key={item.id} className="grid gap-2.5 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_120px_140px_160px]">
                      <div>
                        <p className="text-sm font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Bisa diretur: {formatQty(remaining)} · Harga: {formatRupiah(item.unit_price)}
                        </p>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Jumlah retur</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={remaining}
                          placeholder="0"
                          value={state.qty}
                          onChange={(e) => updateItem(item.id, { qty: e.target.value })}
                          className={`${inputClass} text-right`}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Kondisi</label>
                        <select
                          value={state.condition}
                          onChange={(e) => updateItem(item.id, { condition: e.target.value as ReturnCondition })}
                          className={inputClass}
                        >
                          {CONDITIONS.map((c) => (
                            <option key={c} value={c}>
                              {CONDITION_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground">Lokasi rak tujuan</label>
                        <select
                          value={state.location_id}
                          onChange={(e) => updateItem(item.id, { location_id: e.target.value })}
                          className={inputClass}
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.code} : {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-foreground">Bentuk penyelesaian</label>
                <select
                  value={settlement}
                  onChange={(e) => setSettlement(e.target.value as ReturnSettlement)}
                  className={`mt-1 ${inputClass}`}
                >
                  {SETTLEMENTS.map((s) => (
                    <option key={s} value={s} disabled={s === "debt" && (!customerName || outstanding <= 0)}>
                      {SETTLEMENT_LABEL[s]} {s === "debt" && outstanding > 0 ? `(Sisa piutang: ${formatRupiah(outstanding)})` : ""}
                    </option>
                  ))}
                </select>
                {settlement === "debt" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mengurangi saldo piutang nota pelanggan {customerName}.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Tanggal retur</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            {settlement === "refund" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Metode uang kembali</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as "cash" | "transfer")}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="cash">Uang tunai (kas shift)</option>
                    <option value="transfer">Transfer bank</option>
                  </select>
                  {payMethod === "cash" && !shiftOpen && (
                    <p className="mt-1 text-xs text-brand-red">Shift kasir sedang tidak terbuka.</p>
                  )}
                </div>

                {payMethod === "transfer" && (
                  <div>
                    <label className="text-xs font-medium text-foreground">Akun bank sumber pengembalian</label>
                    <select
                      value={cashAccountId}
                      onChange={(e) => setCashAccountId(e.target.value)}
                      className={`mt-1 ${inputClass}`}
                    >
                      <option value="">Pilih akun kas / bank</option>
                      {cashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <FormField
                id="ret_reason"
                label="Alasan retur (wajib)"
                placeholder="Contoh: Barang salah ukuran, cacat fisik, kelebihan beli..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div>
              <FormField
                id="ret_pin"
                label="PIN persetujuan Owner / Admin (opsional)"
                placeholder="Wajib jika melewati batas 7 hari nota"
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>

            {estimatedTotal > 0 && (
              <div className="rounded-md bg-muted/60 p-3 text-right">
                <span className="text-xs text-muted-foreground">Perkiraan nilai retur barang: </span>
                <span className="text-base font-bold tabular-nums text-foreground">{formatRupiah(estimatedTotal)}</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending || activeItems.length === 0} className="bg-brand-red hover:bg-brand-red/90 text-white">
              {pending ? "Memproses..." : "Posting retur"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}

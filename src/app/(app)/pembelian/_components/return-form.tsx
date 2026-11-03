"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { formatQty } from "@/lib/format";
import type { CashBankAccount, ReceiptItem } from "@/lib/purchasing";
import { returnSchema, type ReturnInput } from "@/lib/validation/purchasing";
import { postPurchaseReturnAction } from "../actions";
import { SelectField } from "./ui";

export function ReturnForm({ receiptId, items, cashAccounts, today }: { receiptId: string; items: ReceiptItem[]; cashAccounts: CashBankAccount[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const returnable = items.filter((i) => i.base_qty - i.returned_base_qty > 0);
  const { register, handleSubmit, control, formState, reset } = useForm<ReturnInput>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_date: today,
      settlement: "debt",
      cash_bank_account_id: "",
      reason: "",
      items: returnable.map((i) => ({ receipt_item_id: i.id, base_qty: "" })),
    },
  });
  const settlement = useWatch({ control, name: "settlement" });
  const errors = formState.errors;

  if (returnable.length === 0) return null;
  if (!open)
    return (
      <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        <Undo2 className="size-4" /> Retur ke supplier
      </Button>
    );

  return (
    <form
      noValidate
      className="grid gap-3 rounded-sm border border-border p-4"
      onSubmit={handleSubmit((v) =>
        startTransition(async () => {
          setMessage(null);
          const r = await postPurchaseReturnAction(receiptId, v);
          if (!r.ok) return setMessage({ ok: false, text: r.error });
          reset();
          setOpen(false);
          router.refresh();
        }),
      )}
    >
      <h3 className="font-semibold">Retur ke supplier</h3>
      <p className="text-xs text-muted-foreground">Dinilai sebesar harga beli di faktur ini. Jumlah dalam satuan dasar barang.</p>
      <ul className="grid gap-2">
        {returnable.map((i, idx) => (
          <li key={i.id} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{i.item_name}</p>
              <p className="text-xs text-muted-foreground">
                Bisa diretur {formatQty(i.base_qty - i.returned_base_qty)} {i.base_unit} · {i.location}
              </p>
            </div>
            <input
              inputMode="decimal"
              placeholder="0"
              aria-label={`Jumlah retur ${i.item_name}`}
              className={`${inputClass} text-right`}
              {...register(`items.${idx}.base_qty`)}
            />
            <input type="hidden" {...register(`items.${idx}.receipt_item_id`)} />
          </li>
        ))}
      </ul>
      {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField id="settlement" label="Penyelesaian" {...register("settlement")}>
          <option value="debt">Potong hutang ke supplier</option>
          <option value="refund">Uang kembali</option>
        </SelectField>
        <FormField id="return_date" label="Tanggal retur" type="date" {...register("return_date")} />
        {settlement === "refund" && (
          <SelectField id="ret_cash" label="Uang masuk ke" error={errors.cash_bank_account_id?.message} {...register("cash_bank_account_id")}>
            <option value="">— Pilih —</option>
            {cashAccounts
              .filter((a) => a.is_active)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </SelectField>
        )}
      </div>
      <FormField id="reason" label="Alasan retur *" placeholder="mis. Barang rusak / salah kirim" error={errors.reason?.message} {...register("reason")} />
      {message && <FormError message={message.text} />}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan retur"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}

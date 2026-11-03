"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/page-kit";
import { voidSupplierPaymentAction } from "../actions";

/** Batalkan pembayaran (jurnal pembalik dibuat otomatis; dokumen tetap tersimpan berstatus batal). */
export function VoidPayment({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-muted-foreground hover:text-brand-red">
        Batalkan
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembatalan" className={`${inputClass} h-8 w-48`} />
      <Button
        size="sm"
        variant="destructive"
        disabled={pending || reason.trim().length < 3}
        onClick={() =>
          startTransition(async () => {
            const r = await voidSupplierPaymentAction(id, reason);
            if (!r.ok) return setError(r.error);
            router.refresh();
          })
        }
      >
        Batalkan
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Tidak
      </Button>
      {error && <span className="text-xs text-brand-red">{error}</span>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import type { PoStatus } from "@/lib/purchasing";
import { setPurchaseOrderStatusAction } from "../actions";

/** Tombol aksi PO sesuai status: kirim, terima barang, tutup, batalkan (dengan alasan). */
export function PoActions({ id, status, canUpdate, receive }: { id: string; status: PoStatus; canUpdate: boolean; receive?: React.ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (action: "send" | "close" | "cancel", why?: string) =>
    startTransition(async () => {
      setError(null);
      const r = await setPurchaseOrderStatusAction(id, action, why);
      if (!r.ok) return setError(r.error);
      setCancelling(false);
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {canUpdate && status === "draft" && (
          <Button onClick={() => run("send")} disabled={pending}>
            <Send className="size-4" /> Tandai sudah dikirim ke supplier
          </Button>
        )}
        {(status === "sent" || status === "partial") && receive}
        {canUpdate && (status === "sent" || status === "partial") && (
          <Button variant="outline" onClick={() => run("close")} disabled={pending}>
            Tutup PO
          </Button>
        )}
        {canUpdate && (status === "draft" || status === "sent") && !cancelling && (
          <Button variant="outline" onClick={() => setCancelling(true)} disabled={pending}>
            <XCircle className="size-4" /> Batalkan PO
          </Button>
        )}
      </div>
      {cancelling && (
        <div className="flex flex-wrap gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan pembatalan"
            aria-label="Alasan pembatalan"
            className={`${inputClass} max-w-md flex-1`}
          />
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run("cancel", reason)}>
            Batalkan
          </Button>
          <Button variant="ghost" onClick={() => setCancelling(false)}>
            Tidak jadi
          </Button>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}

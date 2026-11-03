"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { voidStockOpnameAction } from "../actions";

export function VoidOpnameDialog({
  opnameId,
  opnameNo,
}: {
  opnameId: string;
  opnameNo: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Alasan pembatalan minimal 3 karakter");
      return;
    }

    startTransition(async () => {
      const res = await voidStockOpnameAction({
        opname_id: opnameId,
        reason: reason.trim(),
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      toast.success("Sesi stok opname berhasil dibatalkan");
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Ban className="size-4" />
        Batalkan Sesi
      </Button>

      <FormDialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
        title={`Batalkan Sesi ${opnameNo}`}
        description="Sesi opname yang dibatalkan tidak akan memengaruhi saldo stok maupun jurnal akuntansi."
        size="md"
      >
        <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col px-5 py-4 sm:px-7">
          {error && (
            <div className="mb-4">
              <FormError message={error} />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Alasan Pembatalan <span className="text-destructive">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
              placeholder="Contoh: Jadwal opname digeser ke minggu depan"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">Wajib diisi minimal 3 karakter</p>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Kembali
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending}
            >
              {pending ? "Membatalkan..." : "Konfirmasi Batal"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}

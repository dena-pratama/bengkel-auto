"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, FileText, MessageCircle, Printer, ReceiptText, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { approveShiftAction, paySaleAction, voidPaymentAction, voidSaleAction } from "../actions";
import { PaymentLines } from "./payment-lines";

type Result = { ok: true } | { ok: false; error: string };

/** Bayar sisa tagihan (pelunasan piutang) */
export function PayDialog({ saleId, saleNo, outstanding, label = "Terima pembayaran" }: { saleId: string; saleNo: string; outstanding: number; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <FormDialog open={open} onOpenChange={setOpen} title={`Pembayaran ${saleNo}`} description="Boleh dibayar sebagian atau dengan beberapa metode." size="lg">
        <PaymentLines
          due={outstanding}
          allowCredit
          submitLabel="Simpan pembayaran"
          onSubmit={(v) => paySaleAction(saleId, v)}
          onDone={() => {
            toast.success("Pembayaran dicatat.");
            setOpen(false);
            router.refresh();
          }}
        />
      </FormDialog>
    </>
  );
}

/** Batalkan pembayaran (shift masih terbuka) dengan alasan */
export function VoidPaymentButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async () => {
    setPending(true);
    setError(null);
    const r: Result = await voidPaymentAction(id, reason);
    setPending(false);
    if (!r.ok) return setError(r.error);
    toast.success("Pembayaran dibatalkan.");
    setOpen(false);
    router.refresh();
  };
  return open ? (
    <span className="flex flex-wrap items-center gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan pembatalan pembayaran" className={cn(inputClass, "h-9 w-48 px-3")} />
      <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 3} onClick={submit}>
        Batalkan
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Tidak
      </Button>
      <FormError message={error} />
    </span>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
      <Undo2 className="size-3.5" /> Batalkan
    </Button>
  );
}

/** Batalkan invoice / hapus draft. Invoice butuh PIN persetujuan jika pemanggil tidak punya izin approve. */
export function VoidSaleControl({ id, posted, needsPin }: { id: string; posted: boolean; needsPin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async () => {
    setPending(true);
    setError(null);
    const r: Result = await voidSaleAction(id, reason, pin);
    setPending(false);
    if (!r.ok) return setError(r.error);
    toast.success(posted ? "Invoice dibatalkan." : "Draft dibatalkan.");
    setOpen(false);
    router.refresh();
  };
  return (
    <div className="grid gap-2">
      {open ? (
        <div className="flex flex-wrap gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" className={`${inputClass} max-w-md flex-1`} />
          {posted && needsPin && (
            <input type="password" inputMode="numeric" maxLength={6} placeholder="PIN Owner/Admin" aria-label="PIN persetujuan" value={pin} onChange={(e) => setPin(e.target.value)} className={`${inputClass} w-40`} />
          )}
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={submit}>
            {posted ? "Batalkan invoice" : "Batalkan draft"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Tidak jadi
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <Ban className="size-4" /> {posted ? "Batalkan invoice" : "Batalkan draft"}
          </Button>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}

const PAPER = {
  a4: "@page { size: A4; margin: 12mm }",
  "80": "@page { size: 80mm auto; margin: 3mm }",
  "58": "@page { size: 58mm auto; margin: 2mm }",
} as const;

/** Cetak invoice A4 atau nota thermal 58/80 mm (ukuran kertas diatur lewat @page sementara), unduh PDF, kirim WhatsApp. */
function printAs(paper: keyof typeof PAPER) {
  const style = document.createElement("style");
  style.id = "paper-style";
  style.textContent = `@media print { ${PAPER[paper]} }`;
  document.head.appendChild(style);
  if (paper !== "a4") document.body.dataset.paper = paper;
  const done = () => {
    style.remove();
    delete document.body.dataset.paper;
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

export function PrintAndShare({ waLink, pdfHref }: { waLink: string | null; pdfHref?: string }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button variant="outline" onClick={() => printAs("a4")}>
        <Printer className="size-4" /> Cetak A4
      </Button>
      <Button variant="outline" onClick={() => printAs("80")}>
        <ReceiptText className="size-4" /> Nota 80 mm
      </Button>
      <Button variant="outline" onClick={() => printAs("58")}>
        <ReceiptText className="size-4" /> Nota 58 mm
      </Button>
      {pdfHref && (
        <Button variant="outline" nativeButton={false} render={<a href={pdfHref} target="_blank" rel="noreferrer" />}>
          <FileText className="size-4" /> Unduh PDF
        </Button>
      )}
      {waLink && (
        <Button variant="outline" nativeButton={false} render={<a href={waLink} target="_blank" rel="noreferrer" />}>
          <MessageCircle className="size-4" /> Kirim via WhatsApp
        </Button>
      )}
    </div>
  );
}

export function ApproveShiftControl({ id, variance }: { id: string; variance: number }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submit = async () => {
    setPending(true);
    setError(null);
    const r: Result = await approveShiftAction(id, note);
    setPending(false);
    if (!r.ok) return setError(r.error);
    toast.success("Laporan shift disetujui.");
    router.refresh();
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan persetujuan (opsional)" aria-label="Catatan persetujuan" className={`${inputClass} max-w-md flex-1`} />
        <Button disabled={pending} onClick={submit}>
          Setujui laporan
        </Button>
      </div>
      {variance !== 0 && <p className="text-xs text-muted-foreground">Selisih {formatRupiah(variance)} akan dijurnal ke akun Selisih Kas.</p>}
      <FormError message={error} />
    </div>
  );
}

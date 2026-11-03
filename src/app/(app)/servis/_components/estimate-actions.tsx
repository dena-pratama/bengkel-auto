"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { CHANNELS, CHANNEL_LABEL, type ApprovalChannel, type EstimateStatus } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import { approveEstimateAction, convertEstimateAction, markEstimateSentAction, rejectEstimateAction, voidEstimateAction } from "../actions";

type Panel = null | "approve" | "reject" | "void";

/** Aksi estimasi sesuai status: kirim WA, setujui (dan jadikan WO), tolak, jadikan WO, batalkan. */
export function EstimateActions({
  id,
  status,
  isAdditional,
  expired,
  waLink,
  canUpdate,
  canCreate,
  canVoid,
}: {
  id: string;
  status: EstimateStatus;
  isAdditional: boolean;
  expired: boolean;
  waLink: string | null;
  canUpdate: boolean;
  canCreate: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [channel, setChannel] = useState<ApprovalChannel | "">("");
  const [note, setNote] = useState("");
  const [makeWo, setMakeWo] = useState(!isAdditional && canCreate);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = status === "draft" || status === "sent";

  const run = (fn: () => Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>, message: string, after?: (data: unknown) => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setPanel(null);
      setNote("");
      toast.success(message);
      if (after) after(r.data);
      else router.refresh();
    });

  const goWo = (data: unknown) => {
    const woId = (data as { workOrderId: string | null } | undefined)?.workOrderId;
    if (woId) router.push(`/servis/${woId}`);
    else router.refresh();
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {open && waLink && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={waLink} target="_blank" rel="noreferrer" />}
            onClick={() => {
              if (status === "draft" && canUpdate) void markEstimateSentAction(id).then(() => router.refresh());
            }}
          >
            <MessageCircle className="size-4" /> Kirim via WhatsApp
          </Button>
        )}
        {open && canUpdate && status === "draft" && !waLink && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => markEstimateSentAction(id), "Ditandai terkirim.")}>
            <MessageCircle className="size-4" /> Tandai sudah dikirim
          </Button>
        )}
        {open && canUpdate && (
          <>
            <Button disabled={pending || (expired && !isAdditional)} onClick={() => setPanel(panel === "approve" ? null : "approve")}>
              <CheckCircle2 className="size-4" /> Catat persetujuan
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setPanel(panel === "reject" ? null : "reject")}>
              <XCircle className="size-4" /> Pelanggan menolak
            </Button>
          </>
        )}
        {status === "approved" && !isAdditional && canCreate && (
          <Button disabled={pending} onClick={() => run(() => convertEstimateAction(id), "Work order dibuat.", goWo)}>
            <Wrench className="size-4" /> Jadikan work order
          </Button>
        )}
        {canVoid && !["revised", "converted", "void"].includes(status) && (
          <Button variant="ghost" disabled={pending} onClick={() => setPanel(panel === "void" ? null : "void")}>
            Batalkan estimasi
          </Button>
        )}
      </div>
      {expired && open && !isAdditional && <p className="text-sm text-brand-red">Masa berlaku sudah lewat. Buat revisi untuk memperbarui harga dan tanggal berlaku.</p>}

      {panel === "approve" && (
        <div className="grid gap-3 rounded-sm border border-border p-3">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cara persetujuan">
            {CHANNELS.map((ch) => (
              <label key={ch} className="flex cursor-pointer items-center gap-2 rounded-sm border border-border px-3 py-2 text-sm has-checked:border-brand-blue-ink has-checked:bg-brand-blue-soft">
                <input type="radio" name="channel" checked={channel === ch} onChange={() => setChannel(ch)} className="accent-brand-blue-ink" />
                {CHANNEL_LABEL[ch]}
              </label>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan (opsional)" aria-label="Catatan persetujuan" className={inputClass} />
          {!isAdditional && canCreate && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={makeWo} onChange={(e) => setMakeWo(e.target.checked)} className="size-4 accent-brand-blue-ink" />
              Langsung buat work order
            </label>
          )}
          <div className="flex gap-2">
            <Button
              disabled={pending || !channel}
              onClick={() =>
                run(
                  () => approveEstimateAction(id, { channel: channel as ApprovalChannel, note, make_work_order: makeWo }),
                  makeWo ? "Disetujui dan work order dibuat." : "Persetujuan dicatat.",
                  goWo,
                )
              }
            >
              Simpan persetujuan
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              Tidak jadi
            </Button>
          </div>
        </div>
      )}
      {(panel === "reject" || panel === "void") && (
        <div className="flex flex-wrap gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={panel === "reject" ? "Alasan pelanggan menolak (opsional)" : "Alasan pembatalan"}
            aria-label={panel === "reject" ? "Alasan penolakan" : "Alasan pembatalan"}
            className={cn(inputClass, "max-w-md flex-1")}
          />
          <Button
            variant="destructive"
            disabled={pending || (panel === "void" && note.trim().length < 3)}
            onClick={() =>
              panel === "reject" ? run(() => rejectEstimateAction(id, note), "Penolakan dicatat.") : run(() => voidEstimateAction(id, note), "Estimasi dibatalkan.")
            }
          >
            {panel === "reject" ? "Catat penolakan" : "Batalkan"}
          </Button>
          <Button variant="ghost" onClick={() => setPanel(null)}>
            Tidak jadi
          </Button>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}

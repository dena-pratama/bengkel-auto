"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { TOAST_MS } from "@/components/app-toaster";
import { FormDialog } from "@/components/form-dialog";
import { panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { ALLOWED_MIMES, MAX_BYTES, type EntityType } from "@/lib/validation/attachments";
import { cn } from "@/lib/utils";

type Att = { id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string };

/** Foto atau dokumen terlampir pada satu dokumen induk. Berkas dibuka lewat /api/v1/attachments/[id] (izin dicek di server). */
export function AttachmentPanel({
  entityType,
  entityId,
  title,
  hint,
  canEdit,
  initial,
  bare = false,
}: {
  entityType: EntityType;
  entityId: string;
  title: string;
  hint?: string;
  canEdit: boolean;
  /** Bila diberikan, tidak perlu memuat daftar saat tampil */
  initial?: Att[];
  /** Tanpa kartu pembungkus (untuk dipakai di dalam pop-up) */
  bare?: boolean;
}) {
  const [items, setItems] = useState<Att[] | null>(initial ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const accept = ALLOWED_MIMES[entityType].join(",");

  const load = useCallback(async () => {
    const r = await fetch(`/api/v1/attachments?entity_type=${entityType}&entity_id=${entityId}`);
    if (!r.ok) return setError("Gagal memuat lampiran.");
    setItems(((await r.json()) as { items: Att[] }).items);
  }, [entityType, entityId]);

  // Muat daftar saat pertama tampil (kecuali sudah diberikan lewat initial)
  useEffect(() => {
    if (initial !== undefined) return;
    let live = true;
    fetch(`/api/v1/attachments?entity_type=${entityType}&entity_id=${entityId}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ items: Att[] }>) : Promise.reject(new Error("gagal"))))
      .then((d) => live && setItems(d.items))
      .catch(() => live && setError("Gagal memuat lampiran."));
    return () => {
      live = false;
    };
  }, [initial, entityType, entityId]);

  const upload = async (file: File) => {
    setError("");
    if (file.size > MAX_BYTES) return setError("Ukuran berkas maksimal 5 MB.");
    setBusy(true);
    const form = new FormData();
    form.set("entity_type", entityType);
    form.set("entity_id", entityId);
    form.set("file", file);
    const r = await fetch("/api/v1/attachments", { method: "POST", body: form });
    setBusy(false);
    if (!r.ok) return setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Gagal mengunggah.");
    toast.success("Lampiran ditambahkan.", { duration: TOAST_MS.action });
    await load();
  };

  const remove = async (id: string) => {
    setError("");
    const r = await fetch(`/api/v1/attachments/${id}`, { method: "DELETE" });
    if (!r.ok) return setError(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? "Gagal melepas lampiran.");
    toast.success("Lampiran dilepas.", { duration: TOAST_MS.action });
    await load();
  };

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {canEdit && (
          <>
            <input
              ref={input}
              type="file"
              accept={accept}
              capture={entityType === "item" ? "environment" : undefined}
              className="sr-only"
              aria-label={`Pilih berkas untuk ${title}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
            <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Paperclip className="size-4" /> {busy ? "Mengunggah..." : "Tambah"}
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {items === null ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada lampiran.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-2xl bg-muted/60">
              <a href={`/api/v1/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block">
                {a.mime_type === "application/pdf" ? (
                  <span className="flex aspect-[4/3] flex-col items-center justify-center gap-1 p-2 text-center text-xs">
                    <FileText className="size-8 text-muted-foreground" />
                    <span className="line-clamp-2 break-all">{a.file_name}</span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/v1/attachments/${a.id}`} alt={a.file_name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                )}
              </a>
              {canEdit && (
                <button
                  type="button"
                  aria-label={`Lepas ${a.file_name}`}
                  onClick={() => void remove(a.id)}
                  className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
  return bare ? <div className="grid gap-3">{body}</div> : <section className={cn(panel, "grid gap-3")}>{body}</section>;
}

/** Tombol kecil yang membuka pop-up lampiran (untuk baris daftar) */
export function AttachmentButton({ entityType, entityId, title, label = "Bukti", canEdit }: { entityType: EntityType; entityId: string; title: string; label?: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Paperclip className="size-3.5" /> {label}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={title} size="md">
        {open && <AttachmentPanel entityType={entityType} entityId={entityId} title="Lampiran" canEdit={canEdit} bare />}
      </FormDialog>
    </>
  );
}

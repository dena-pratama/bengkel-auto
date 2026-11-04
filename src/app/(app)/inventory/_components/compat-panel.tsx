"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { TOAST_MS } from "@/components/app-toaster";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import type { ItemCompat } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { saveItemCompatAction } from "../actions";

const empty = { make: "", model: "", year_from: "", year_to: "", engine: "" };

/** Kendaraan yang cocok untuk barang ini (PRD §4.4). Simpan mengganti seluruh daftar. */
export function CompatPanel({ itemId, initial, known, canEdit }: { itemId: string; initial: ItemCompat[]; known: { make: string; model: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => initial.map((r) => ({ make: r.make, model: r.model, year_from: r.year_from ? String(r.year_from) : "", year_to: r.year_to ? String(r.year_to) : "", engine: r.engine ?? "" })));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const makes = [...new Set(known.map((k) => k.make))].sort();
  const set = (i: number, k: keyof typeof empty, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const listId = `models-${itemId}`;

  const save = () =>
    start(async () => {
      setError(null);
      const r = await saveItemCompatAction(itemId, rows);
      if (!r.ok) return setError(r.error);
      toast.success("Kendaraan yang cocok tersimpan.", { duration: TOAST_MS.action });
      router.refresh();
    });

  return (
    <section className={cn(panel, "grid gap-3")}>
      <div>
        <h3 className="text-lg font-semibold">Cocok untuk kendaraan</h3>
        <p className="text-xs text-muted-foreground">Kosongkan tahun bila berlaku untuk semua tahun. Bisa dicari dari daftar barang (mis. ketik Avanza).</p>
      </div>
      <datalist id={`makes-${itemId}`}>
        {makes.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <datalist id={listId}>
        {[...new Set(known.map((k) => k.model))].sort().map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kendaraan yang dicatat.</p>}
      <ul className="grid gap-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_80px_80px_1fr_auto]">
            <input disabled={!canEdit} list={`makes-${itemId}`} value={r.make} onChange={(e) => set(i, "make", e.target.value)} placeholder="Merek" aria-label="Merek" className={inputClass} />
            <input disabled={!canEdit} list={listId} value={r.model} onChange={(e) => set(i, "model", e.target.value)} placeholder="Model" aria-label="Model" className={inputClass} />
            <input disabled={!canEdit} inputMode="numeric" value={r.year_from} onChange={(e) => set(i, "year_from", e.target.value)} placeholder="Dari" aria-label="Tahun dari" className={inputClass} />
            <input disabled={!canEdit} inputMode="numeric" value={r.year_to} onChange={(e) => set(i, "year_to", e.target.value)} placeholder="Sampai" aria-label="Tahun sampai" className={inputClass} />
            <input disabled={!canEdit} value={r.engine} onChange={(e) => set(i, "engine", e.target.value)} placeholder="Mesin (opsional)" aria-label="Mesin" className={inputClass} />
            {canEdit && (
              <Button type="button" variant="ghost" size="icon" aria-label="Hapus baris" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setRows((r) => [...r, { ...empty }])}>
              <Plus className="size-4" /> Tambah kendaraan
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

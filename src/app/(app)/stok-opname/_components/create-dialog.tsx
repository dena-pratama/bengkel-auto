"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import {
  OPNAME_TYPES,
  OPNAME_TYPE_LABEL,
  type OpnameType,
} from "@/lib/validation/stock-opname";
import type { CategoryRef, EmployeeRef, StorageLocationRef } from "@/lib/stock-opname";
import { createStockOpnameAction } from "../actions";

export function CreateOpnameDialog({
  locations,
  categories,
  employees,
}: {
  locations: StorageLocationRef[];
  categories: CategoryRef[];
  employees: EmployeeRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [opnameType, setOpnameType] = useState<OpnameType>("full");
  const [isBlindCount, setIsBlindCount] = useState(true);
  const [assignedTo, setAssignedTo] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sampleSize, setSampleSize] = useState(20);
  const [notes, setNotes] = useState("");

  const handleToggleLocation = (id: string) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (opnameType === "location" && selectedLocations.length === 0) {
      setError("Pilih minimal satu lokasi rak untuk opname parsial lokasi");
      return;
    }
    if (opnameType === "category" && selectedCategories.length === 0) {
      setError("Pilih minimal satu kategori untuk opname parsial kategori");
      return;
    }
    if (opnameType === "cycle_count" && (sampleSize < 1 || sampleSize > 500)) {
      setError("Jumlah barang cycle count harus antara 1 sampai 500");
      return;
    }

    startTransition(async () => {
      const res = await createStockOpnameAction({
        opname_type: opnameType,
        is_blind_count: isBlindCount,
        assigned_to: assignedTo || undefined,
        notes,
        location_ids: opnameType === "location" ? selectedLocations : undefined,
        category_ids: opnameType === "category" ? selectedCategories : undefined,
        sample_size: opnameType === "cycle_count" ? sampleSize : undefined,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      toast.success("Sesi stok opname berhasil dibuat");
      setOpen(false);
      router.push(`/stok-opname/${res.data.id}`);
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-4" />
        Sesi Baru
      </Button>

      <FormDialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
        title="Buat Sesi Stok Opname"
        description="Pilih jenis cakupan barang dan petugas untuk memulai sesi opname fisik gudang."
        size="lg"
      >
        <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-4 sm:px-7">
          {error && (
            <div className="mb-4">
              <FormError message={error} />
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Jenis Opname <span className="text-destructive">*</span>
              </label>
              <select
                value={opnameType}
                onChange={(e) => setOpnameType(e.target.value as OpnameType)}
                className={inputClass}
                disabled={pending}
              >
                {OPNAME_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {OPNAME_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            {opnameType === "location" && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Pilih Rak Lokasi <span className="text-destructive">*</span>
                </label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2">
                  {locations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Tidak ada lokasi rak aktif.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {locations.map((loc) => (
                        <label
                          key={loc.id}
                          className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={selectedLocations.includes(loc.id)}
                            onChange={() => handleToggleLocation(loc.id)}
                            disabled={pending}
                            className="size-4 rounded border-border"
                          />
                          <span className="font-medium">{loc.code}</span>
                          <span className="text-muted-foreground">({loc.name})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Pilih rak yang akan dihitung</p>
              </div>
            )}

            {opnameType === "category" && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Pilih Kategori Barang <span className="text-destructive">*</span>
                </label>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Tidak ada kategori aktif.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {categories.map((cat) => (
                        <label
                          key={cat.id}
                          className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.id)}
                            onChange={() => handleToggleCategory(cat.id)}
                            disabled={pending}
                            className="size-4 rounded border-border"
                          />
                          <span className="font-medium">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Pilih kategori yang akan dihitung</p>
              </div>
            )}

            {opnameType === "cycle_count" && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">
                  Ukuran Sampel (Jumlah Barang Acak) <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(parseInt(e.target.value) || 20)}
                  className={inputClass}
                  disabled={pending}
                />
                <p className="text-xs text-muted-foreground">Contoh: 20 barang</p>
              </div>
            )}

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Petugas Penghitung</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={inputClass}
                disabled={pending}
              >
                <option value="">(Belum ditentukan / Semua Petugas)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Opsional: tugaskan ke staf gudang tertentu</p>
            </div>

            <div className="rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={isBlindCount}
                  onChange={(e) => setIsBlindCount(e.target.checked)}
                  disabled={pending}
                  className="mt-0.5 size-4 rounded border-border"
                />
                <div>
                  <div className="text-sm font-medium">Mode Hitung Buta (Blind Count)</div>
                  <div className="text-xs text-muted-foreground">
                    Sembunyikan angka stok sistem pada layar penghitung agar hasil perhitungan fisik objektif tanpa bias.
                  </div>
                </div>
              </label>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Catatan</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                placeholder="Contoh: Opname rutin akhir bulan rak suku cadang mesin"
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Opsional: keterangan atau tujuan sesi opname</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Membuat Sesi..." : "Buat Sesi Opname"}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}

"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Tombol uji notifikasi (hanya di halaman pratinjau development). Toast bertahan sampai ditutup agar bisa diperiksa. */
export function ToastButtons() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button variant="outline" onClick={() => toast.success("PO disimpan sebagai draft.", { duration: Infinity })}>
        Sukses
      </Button>
      <Button variant="outline" onClick={() => toast.success("PO disimpan sebagai draft.", { action: { label: "Buka", onClick: () => {} }, duration: Infinity })}>
        Sukses + Buka
      </Button>
      <Button variant="outline" onClick={() => toast.error("Stok tidak cukup di lokasi ini.", { duration: Infinity })}>
        Gagal
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Estimasi tersimpan, tetapi persetujuan gagal.", { duration: Infinity })}>
        Peringatan
      </Button>
    </div>
  );
}

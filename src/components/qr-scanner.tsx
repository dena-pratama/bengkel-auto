"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";

/** Pemindai kamera (Chrome Android / Safari iOS). Memanggil onScan satu kali lalu menutup diri. */
function CameraView({ onScan }: { onScan: (text: string) => void }) {
  const id = useId().replace(/:/g, "");
  const [error, setError] = useState("");
  const done = useRef(false);
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  });

  useEffect(() => {
    let stop: (() => Promise<void>) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(id);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (done.current) return;
            done.current = true;
            cb.current(text);
          },
          () => {},
        );
        stop = async () => {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {}
        };
        if (cancelled) await stop();
      } catch {
        setError("Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau ketik kodenya manual.");
      }
    })();
    return () => {
      cancelled = true;
      void stop?.();
    };
  }, [id]);

  return (
    <div className="grid gap-3">
      <div id={id} className="overflow-hidden rounded-2xl bg-black/90" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Tombol "Scan kamera" + pop-up. onScan menerima teks mentah dari QR atau kode batang. */
export function ScanButton({ onScan, label = "Scan", className }: { onScan: (text: string) => void; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" className={className} onClick={() => setOpen(true)}>
        <ScanLine className="size-4" /> {label}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Scan QR" description="Arahkan kamera ke QR barang atau rak." size="md">
        {open && (
          <CameraView
            onScan={(t) => {
              setOpen(false);
              onScan(t);
            }}
          />
        )}
      </FormDialog>
    </>
  );
}

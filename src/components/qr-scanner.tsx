"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
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

  // Cegah unhandled rejection AbortError saat video element dilepas dari DOM
  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string; message?: string } | undefined;
      const isAbort =
        reason?.name === "AbortError" ||
        (typeof reason?.message === "string" &&
          (reason.message.includes("play()") || reason.message.includes("interrupted")));
      if (isAbort) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;
    let startPromise: Promise<null> | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!isMounted) return;

        const scanner = new Html5Qrcode(id);
        scannerInstance = scanner;

        startPromise = scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (done.current || !isMounted) return;
            done.current = true;
            cb.current(text);
          },
          () => {},
        );

        await startPromise;

        if (!isMounted) {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch {}
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const errObj = err as { name?: string; message?: string } | undefined;
        if (
          errObj?.name === "AbortError" ||
          (typeof errObj?.message === "string" &&
            (errObj.message.includes("play()") || errObj.message.includes("interrupted")))
        ) {
          return;
        }
        setError("Kamera tidak bisa dibuka. Izinkan akses kamera di browser, atau ketik kodenya manual.");
      }
    })();

    return () => {
      isMounted = false;
      if (scannerInstance) {
        const scanner = scannerInstance;
        const cleanup = async () => {
          try {
            if (startPromise) {
              try {
                await startPromise;
              } catch {}
            }
            if (scanner.isScanning) {
              await scanner.stop();
            }
            scanner.clear();
          } catch {}
        };
        void cleanup();
      }
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

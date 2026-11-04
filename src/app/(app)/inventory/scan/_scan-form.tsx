"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { inputClass } from "@/components/page-kit";
import { ScanButton } from "@/components/qr-scanner";
import { Button } from "@/components/ui/button";
import { parseQr } from "@/lib/qr";

/** Kotak scan: pemindai USB mengetik kode lalu Enter; kamera lewat tombol Scan. */
export function ScanForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [initial]);

  const go = (raw: string) => {
    const t = parseQr(raw);
    if (!t) return setError("Kode tidak dikenali. Gunakan QR dari label barang atau rak.");
    setError("");
    router.push(`/inventory/scan?kode=${encodeURIComponent(raw.trim())}`);
  };

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1">
          <ScanLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Scan dengan pemindai USB, atau ketik kode (mis. I:OLI-5W30)"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} pl-9 font-mono`}
          />
        </div>
        <Button type="submit" className="h-11">
          Cari
        </Button>
        <ScanButton
          label="Scan kamera"
          className="h-11 rounded-[14px]"
          onScan={(t) => {
            setValue(t);
            go(t);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

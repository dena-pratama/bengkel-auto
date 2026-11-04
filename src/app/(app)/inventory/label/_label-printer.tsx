"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { itemQr, locationQr } from "@/lib/qr";
import { cn } from "@/lib/utils";

type Entry = { id: string; code: string; name: string };
type Size = "30x20" | "50x30" | "a4";

const SIZES: Record<Size, { label: string; w: number; h: number; qr: number; page: string }> = {
  "30x20": { label: "Thermal 30 x 20 mm", w: 30, h: 20, qr: 15, page: "30mm 20mm; margin: 0" },
  "50x30": { label: "Thermal 50 x 30 mm", w: 50, h: 30, qr: 24, page: "50mm 30mm; margin: 0" },
  a4: { label: "Lembar A4 (label 50 x 30 mm)", w: 50, h: 30, qr: 24, page: "A4; margin: 10mm" },
};

export function LabelPrinter({ items, locations }: { items: Entry[]; locations: Entry[] }) {
  const [kind, setKind] = useState<"item" | "location">("item");
  const [size, setSize] = useState<Size>("50x30");
  const [copies, setCopies] = useState(1);
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [images, setImages] = useState<Record<string, string>>({});

  const source = kind === "item" ? items : locations;
  const payload = (e: Entry) => (kind === "item" ? itemQr(e.code) : locationQr(e.code));
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return source.filter((e) => !q || e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
  }, [source, filter]);
  const chosen = source.filter((e) => picked.has(`${kind}:${e.id}`));
  const key = (e: Entry) => `${kind}:${e.id}`;

  useEffect(() => {
    let live = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const e of chosen) next[key(e)] = await QRCode.toDataURL(payload(e), { margin: 0, errorCorrectionLevel: "M", width: 240 });
      if (live) setImages(next);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, kind]);

  const toggle = (e: Entry) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key(e))) n.delete(key(e));
      else n.add(key(e));
      return n;
    });
  const spec = SIZES[size];
  const labels = chosen.flatMap((e) => Array.from({ length: copies }, (_, i) => ({ e, i })));

  return (
    <>
      <style>{`@media print { @page { size: ${spec.page}; } }`}</style>
      <div className="grid gap-5 print:hidden">
        <section className={cn(panel, "grid gap-4")}>
          <div className="flex flex-wrap items-end gap-3">
            <div role="tablist" aria-label="Jenis label" className="flex rounded-full bg-muted p-1 text-sm font-medium">
              {(["item", "location"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={cn("rounded-full px-4 py-1.5 transition-colors", kind === k ? "bg-card shadow-sm" : "text-muted-foreground")}
                >
                  {k === "item" ? "Barang" : "Rak"}
                </button>
              ))}
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Ukuran label
              <select value={size} onChange={(e) => setSize(e.target.value as Size)} className={inputClass}>
                {Object.entries(SIZES).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Salinan per label
              <input type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className={cn(inputClass, "w-28")} />
            </label>
            <Button disabled={labels.length === 0} onClick={() => window.print()} className="h-11">
              <Printer className="size-4" /> Cetak {labels.length} label
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">QR hanya berisi kode (tanpa harga). Di dialog cetak, matikan header/footer dan pilih skala 100%.</p>
        </section>

        <section className={cn(panel, "grid gap-3")}>
          <div className="flex flex-wrap items-center gap-3">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cari kode atau nama…" className={cn(inputClass, "max-w-sm")} />
            <Button type="button" variant="outline" onClick={() => setPicked((p) => new Set([...p, ...shown.map(key)]))}>
              Pilih semua yang tampil
            </Button>
            <Button type="button" variant="outline" disabled={picked.size === 0} onClick={() => setPicked(new Set())}>
              Kosongkan
            </Button>
            <span className="text-sm text-muted-foreground">{chosen.length} dipilih</span>
          </div>
          <ul className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
            {shown.map((e) => (
              <li key={e.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm hover:bg-muted">
                  <input type="checkbox" checked={picked.has(key(e))} onChange={() => toggle(e)} className="size-4 accent-[var(--brand-blue)]" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{e.code}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap content-start gap-[2mm] print:gap-0" aria-label="Pratinjau label">
        {labels.map(({ e, i }) => (
          <div
            key={`${e.id}-${i}`}
            style={{ width: `${spec.w}mm`, height: `${spec.h}mm`, breakInside: "avoid", pageBreakAfter: size === "a4" ? "auto" : "always" }}
            className="flex items-center gap-[1.5mm] overflow-hidden rounded-[1mm] border border-dashed border-border bg-white p-[1.5mm] text-black print:rounded-none print:border-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[key(e)]} alt="" style={{ width: `${spec.qr}mm`, height: `${spec.qr}mm` }} className="shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="font-mono font-bold break-all" style={{ fontSize: size === "30x20" ? "6pt" : "8pt" }}>
                {e.code}
              </p>
              <p className="line-clamp-3" style={{ fontSize: size === "30x20" ? "5pt" : "7pt" }}>
                {e.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

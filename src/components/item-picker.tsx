"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { inputClass } from "@/components/page-kit";
import { ScanButton } from "@/components/qr-scanner";
import { formatQty } from "@/lib/format";
import { parseQr } from "@/lib/qr";
import { cn } from "@/lib/utils";

export type PickerItem = {
  id: string;
  sku: string;
  name: string;
  base_unit: string;
  qty: number;
};

/** Kotak cari barang (nama / SKU) dengan daftar pilihan; dipakai form pembelian, kasir, servis. */
export function ItemPicker({
  items,
  onPick,
  exclude = [],
  placeholder = "Cari nama atau SKU barang…",
  scan = true,
}: {
  items: PickerItem[];
  onPick: (item: PickerItem) => void;
  exclude?: string[];
  placeholder?: string;
  /** Tampilkan tombol scan kamera. Pemindai USB selalu jalan: scan lalu Enter di kotak cari. */
  scan?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          !exclude.includes(i.id) &&
          (!q ||
            i.name.toLowerCase().includes(q) ||
            i.sku.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [items, query, exclude]);

  const pick = (i: PickerItem) => {
    onPick(i);
    setQuery("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  };

  // Isi QR barang (I:SKU) atau SKU polos dari pemindai: langsung pilih barangnya
  const pickByCode = (raw: string) => {
    const t = parseQr(raw);
    if (!t || t.kind === "location") return false;
    const hit = items.find(
      (i) => i.sku.toUpperCase() === t.code && !exclude.includes(i.id),
    );
    if (!hit) return false;
    pick(hit);
    return true;
  };

  return (
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          className={cn(inputClass, "pl-9")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && pickByCode(query)) {
              e.preventDefault();
            } else if (e.key === "Enter" && open && results[active]) {
              e.preventDefault();
              pick(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {open && results.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-sm border border-border bg-popover p-1 shadow-lg"
          >
            {results.map((i, idx) => (
              <li
                key={i.id}
                role="option"
                aria-selected={idx === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(i);
                }}
                onMouseEnter={() => setActive(idx)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-sm",
                  idx === active && "bg-accent",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {i.sku}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  stok {formatQty(i.qty)} {i.base_unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {scan && (
        <ScanButton
          onScan={(t) => {
            if (!pickByCode(t)) {
              setQuery(t.replace(/^I:/i, ""));
              setOpen(true);
            }
          }}
          className="h-11 shrink-0 rounded-[14px]"
        />
      )}
    </div>
  );
}

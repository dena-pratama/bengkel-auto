"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { inputClass } from "@/components/page-kit";
import { formatQty, formatRupiah } from "@/lib/format";
import type { CatalogOption, VehicleOption } from "@/lib/service";
import { cn } from "@/lib/utils";

const TYPE_LABEL = { service: "Jasa", part: "Part", package: "Paket" } as const;
const TYPE_STYLE = { service: "bg-brand-blue-soft text-brand-blue-fg", part: "bg-brand-sand-soft text-foreground", package: "bg-brand-blue-ink text-white" } as const;
const norm = (v: string) => v.toLowerCase().replace(/[\s.-]/g, "");

export function TypeTag({ type }: { type: CatalogOption["type"] }) {
  return <span className={cn("rounded-sm px-1.5 py-0.5 text-[11px] font-medium", TYPE_STYLE[type])}>{TYPE_LABEL[type]}</span>;
}

/** Kotak cari dengan daftar pilihan (keyboard: panah, Enter, Esc) */
function SearchList<T>({
  options,
  match,
  render,
  keyOf,
  onPick,
  placeholder,
  ariaLabel,
}: {
  options: T[];
  match: (o: T, q: string) => boolean;
  render: (o: T) => React.ReactNode;
  keyOf: (o: T) => string;
  onPick: (o: T) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const q = norm(query);
    return options.filter((o) => !q || match(o, q)).slice(0, 10);
  }, [options, query, match]);

  const pick = (o: T) => {
    onPick(o);
    setQuery("");
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
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
          } else if (e.key === "Enter" && open && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-sm border border-border bg-popover p-1 shadow-lg">
          {results.map((o, idx) => (
            <li
              key={keyOf(o)}
              role="option"
              aria-selected={idx === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(idx)}
              className={cn("cursor-pointer rounded-sm px-2.5 py-2 text-sm", idx === active && "bg-accent")}
            >
              {render(o)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Cari jasa, paket, atau part (nama / kode / SKU) */
export function CatalogPicker({ options, onPick }: { options: CatalogOption[]; onPick: (o: CatalogOption) => void }) {
  return (
    <SearchList
      options={options}
      match={(o, q) => norm(o.name).includes(q) || norm(o.code).includes(q)}
      keyOf={(o) => o.key}
      onPick={onPick}
      placeholder="Cari jasa, paket, atau part (nama / kode)…"
      ariaLabel="Cari jasa, paket, atau part"
      render={(o) => (
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <TypeTag type={o.type} />
              <span className="truncate font-medium">{o.name}</span>
            </span>
            <span className="block font-mono text-xs text-muted-foreground">
              {o.code}
              {o.detail && ` · ${o.detail}`}
            </span>
          </span>
          <span className="shrink-0 text-right text-xs tabular-nums">
            <span className="block font-medium">{formatRupiah(o.price)}</span>
            {o.type === "part" && (
              <span className={cn("block", (o.stock ?? 0) <= 0 ? "text-brand-red" : "text-muted-foreground")}>
                stok {formatQty(o.stock)} {o.unit}
              </span>
            )}
          </span>
        </span>
      )}
    />
  );
}

/** Cari kendaraan lewat nomor polisi (atau nama pemilik / model) */
export function VehiclePicker({ options, onPick }: { options: VehicleOption[]; onPick: (o: VehicleOption) => void }) {
  return (
    <SearchList
      options={options}
      match={(o, q) => [o.plate_no, o.customer_name ?? "", o.label].some((x) => norm(x).includes(q))}
      keyOf={(o) => o.id}
      onPick={onPick}
      placeholder="Ketik nomor polisi, mis. B 1234 KJT…"
      ariaLabel="Cari kendaraan"
      render={(o) => (
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-mono font-semibold">{o.plate_no}</span>
            <span className="block truncate text-xs text-muted-foreground">{[o.label, o.customer_name].filter(Boolean).join(" · ") || "Tanpa keterangan"}</span>
          </span>
          {o.last_odometer != null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatQty(o.last_odometer)} km</span>}
        </span>
      )}
    />
  );
}

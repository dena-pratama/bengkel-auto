"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Car, ChevronRight, Search, User, Users } from "lucide-react";
import { EmptyState, SectionNav, inputClass, panel } from "@/components/page-kit";
import type { Customer, Vehicle } from "@/lib/customers";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "customers", href: "/pelanggan", label: "Pelanggan", icon: Users },
  { key: "vehicles", href: "/pelanggan/kendaraan", label: "Kendaraan", icon: Car },
] as const;

export function CustomersNav({ active }: { active: "customers" | "vehicles" }) {
  return <SectionNav tabs={TABS} active={active} label="Bagian pelanggan" />;
}

const norm = (v: string) => v.toLowerCase().replace(/[\s.-]/g, "");

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative min-w-0 flex-1 basis-64">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cn(inputClass, "pl-9")} />
    </label>
  );
}

/** Pelanggan: cari nama, HP, kode, atau nomor polisi kendaraannya (PRD §6.1) */
export function CustomersList({ customers, vehicles }: { customers: Customer[]; vehicles: Vehicle[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | Customer["type"]>("all");
  const plates = useMemo(() => {
    const m = new Map<string, Vehicle[]>();
    for (const v of vehicles) if (v.customer_id) m.set(v.customer_id, [...(m.get(v.customer_id) ?? []), v]);
    return m;
  }, [vehicles]);
  const shown = useMemo(() => {
    const q = norm(query);
    return customers.filter(
      (c) =>
        (type === "all" || c.type === type) &&
        (c.is_active || q) &&
        (!q || [c.name, c.code, c.phone ?? "", ...(plates.get(c.id) ?? []).map((v) => v.plate_no)].some((x) => norm(x).includes(q))),
    );
  }, [customers, plates, query, type]);

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Cari nama, nomor HP, atau nomor polisi…" />
        <div className="flex gap-1" role="tablist" aria-label="Tipe pelanggan">
          {(["all", "individual", "company"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={cn("rounded-sm px-3 py-2 text-sm font-medium", type === t ? "bg-brand-blue-ink text-white" : "bg-muted text-muted-foreground hover:text-foreground")}
            >
              {t === "all" ? "Semua" : t === "individual" ? "Perorangan" : "Perusahaan"}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Users} text={customers.length === 0 ? "Belum ada pelanggan." : "Tidak ada yang cocok."} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((c) => {
            const vs = plates.get(c.id) ?? [];
            return (
              <li key={c.id}>
                <Link href={`/pelanggan/${c.id}`} className={cn("flex h-full items-center gap-3 rounded-sm border border-border p-3 hover:bg-muted/60", !c.is_active && "opacity-60")}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-brand-blue-soft text-brand-blue-fg">
                    {c.type === "company" ? <Building2 className="size-5" /> : <User className="size-5" />}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{c.code}</span>
                      {c.phone && ` · ${c.phone}`}
                    </p>
                    {vs.length > 0 && (
                      <p className="flex flex-wrap gap-1">
                        {vs.slice(0, 3).map((v) => (
                          <span key={v.id} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-2xs">
                            {v.plate_no}
                          </span>
                        ))}
                        {vs.length > 3 && <span className="text-2xs text-muted-foreground">+{vs.length - 3}</span>}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function VehiclesList({ vehicles }: { vehicles: Vehicle[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = norm(query);
    return vehicles.filter(
      (v) => (v.is_active || q) && (!q || [v.plate_no, v.customer_name ?? "", v.customer_phone ?? "", v.make_name ?? "", v.model_name ?? ""].some((x) => norm(x).includes(q))),
    );
  }, [vehicles, query]);

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <SearchBox value={query} onChange={setQuery} placeholder="Cari nomor polisi, pemilik, atau model…" />
      {shown.length === 0 ? (
        <EmptyState icon={Car} text={vehicles.length === 0 ? "Belum ada kendaraan." : "Tidak ada yang cocok."} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((v) => (
            <li key={v.id}>
              <Link href={`/pelanggan/kendaraan/${v.id}`} className={cn("flex h-full items-center gap-3 rounded-sm border border-border p-3 hover:bg-muted/60", !v.is_active && "opacity-60")}>
                <span className="shrink-0 rounded-sm border-2 border-foreground/80 bg-card px-2 py-1 font-mono text-sm font-bold tracking-wide">{v.plate_no}</span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="truncate text-sm font-medium">{[v.make_name, v.model_name, v.variant, v.year].filter(Boolean).join(" ") || "Model belum diisi"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.customer_name ?? "Tanpa pemilik"}
                    {v.last_odometer != null && ` · ${formatQty(v.last_odometer)} km`}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, Building2, Car, ChevronRight, Search, User, Users } from "lucide-react";
import { LocalFilters, uniqueOptions } from "@/components/local-filter";
import { EmptyState, SectionNav, inputClass, panel } from "@/components/page-kit";
import type { Customer, Vehicle } from "@/lib/customers";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "customers", href: "/pelanggan", label: "Pelanggan", icon: Users },
  { key: "vehicles", href: "/pelanggan/kendaraan", label: "Kendaraan", icon: Car },
  { key: "reminder", href: "/pelanggan/reminder", label: "Reminder servis", icon: BellRing },
] as const;

export function CustomersNav({ active }: { active: "customers" | "vehicles" | "reminder" }) {
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
  const [state, setState] = useState("");
  const [credit, setCredit] = useState("");
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
        (state === "nonaktif" ? !c.is_active : state === "aktif" ? c.is_active : c.is_active || q) &&
        (!credit || (credit === "kredit" ? c.payment_terms_days > 0 || c.credit_limit > 0 : c.payment_terms_days === 0 && c.credit_limit === 0)) &&
        (!q || [c.name, c.code, c.phone ?? "", ...(plates.get(c.id) ?? []).map((v) => v.plate_no)].some((x) => norm(x).includes(q))),
    );
  }, [customers, plates, query, type, state, credit]);

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
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                type === t ? "bg-brand-rail text-white" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "all" ? "Semua" : t === "individual" ? "Perorangan" : "Perusahaan"}
            </button>
          ))}
        </div>
      </div>
      <LocalFilters
        selects={[
          { key: "status", label: "Status", value: state, options: [{ value: "aktif", label: "Aktif" }, { value: "nonaktif", label: "Nonaktif" }], allLabel: "Aktif (bawaan)", onChange: setState },
          { key: "kredit", label: "Pembayaran", value: credit, options: [{ value: "kredit", label: "Boleh tempo atau kredit" }, { value: "tunai", label: "Tunai saja" }], allLabel: "Semua", onChange: setCredit },
        ]}
        dirty={Boolean(state || credit)}
        onReset={() => {
          setState("");
          setCredit("");
        }}
      />
      {shown.length === 0 ? (
        <EmptyState icon={Users} text={customers.length === 0 ? "Belum ada pelanggan." : "Tidak ada yang cocok."} />
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((c) => {
            const vs = plates.get(c.id) ?? [];
            return (
              <li key={c.id}>
                <Link href={`/pelanggan/${c.id}`} className={cn("flex h-full items-center gap-3.5 rounded-xl border border-border bg-card p-3.5 transition-all hover:border-brand-blue hover:shadow-sm", !c.is_active && "opacity-60")}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft text-brand-blue-fg">
                    {c.type === "company" ? <Building2 className="size-5" /> : <User className="size-5" />}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="truncate font-semibold text-[13px]">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{c.code}</span>
                      {c.phone && ` · ${c.phone}`}
                    </p>
                    {vs.length > 0 && (
                      <p className="flex flex-wrap gap-1 pt-0.5">
                        {vs.slice(0, 3).map((v) => (
                          <span key={v.id} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-2xs font-medium">
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
  const [make, setMake] = useState("");
  const [owner, setOwner] = useState("");
  const [year, setYear] = useState("");
  const makeOptions = useMemo(() => uniqueOptions(vehicles.map((v) => v.make_name)), [vehicles]);
  const yearOptions = useMemo(() => [...new Set(vehicles.map((v) => v.year).filter((y): y is number => y != null))].sort((a, b) => b - a).map((y) => ({ value: String(y), label: String(y) })), [vehicles]);
  const shown = useMemo(() => {
    const q = norm(query);
    return vehicles.filter(
      (v) => (v.is_active || q) && (!make || v.make_name === make) && (!year || String(v.year) === year) && (!owner || (owner === "ada" ? Boolean(v.customer_id) : !v.customer_id)) && (!q || [v.plate_no, v.customer_name ?? "", v.customer_phone ?? "", v.make_name ?? "", v.model_name ?? ""].some((x) => norm(x).includes(q))),
    );
  }, [vehicles, query, make, owner, year]);

  return (
    <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
      <SearchBox value={query} onChange={setQuery} placeholder="Cari nomor polisi, pemilik, atau model…" />
      <LocalFilters
        selects={[
          { key: "merek", label: "Merek", value: make, options: makeOptions, allLabel: "Semua merek", onChange: setMake },
          { key: "tahun", label: "Tahun", value: year, options: yearOptions, allLabel: "Semua tahun", onChange: setYear },
          { key: "pemilik", label: "Pemilik", value: owner, options: [{ value: "ada", label: "Ada pemilik" }, { value: "tanpa", label: "Tanpa pemilik" }], allLabel: "Semua", onChange: setOwner },
        ]}
        dirty={Boolean(make || year || owner)}
        onReset={() => {
          setMake("");
          setYear("");
          setOwner("");
        }}
      />
      {shown.length === 0 ? (
        <EmptyState icon={Car} text={vehicles.length === 0 ? "Belum ada kendaraan." : "Tidak ada yang cocok."} />
      ) : (
        <ul className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((v) => (
            <li key={v.id}>
              <Link href={`/pelanggan/kendaraan/${v.id}`} className={cn("flex h-full items-center gap-3.5 rounded-xl border border-border bg-card p-3.5 transition-all hover:border-brand-blue hover:shadow-sm", !v.is_active && "opacity-60")}>
                <span className="shrink-0 rounded-md border border-border bg-muted/60 px-2.5 py-1.5 font-mono text-xs font-bold tracking-wide">{v.plate_no}</span>
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="truncate text-[13px] font-semibold">{[v.make_name, v.model_name, v.variant, v.year].filter(Boolean).join(" ") || "Model belum diisi"}</p>
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

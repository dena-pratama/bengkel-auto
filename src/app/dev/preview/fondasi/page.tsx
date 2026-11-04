import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Plus, Download, Wrench, Receipt } from "lucide-react";
import { SectionNav, inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/topbar-controls";

// Pratinjau fondasi desain (token, tombol, isian, tab, kartu) tanpa login, HANYA saat development.
export default function FondasiPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

const TABS = [
  { key: "a", href: "#", label: "Dashboard", icon: Wrench },
  { key: "b", href: "#", label: "Penjualan & invoice", icon: Receipt },
] as const;

const chip = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium";

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid max-w-[1000px] gap-5 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">Halo, Tama! Apa rencana bengkel hari ini?</h1>
        <ThemeToggle />
      </div>
      <p className="text-sm text-muted-foreground">Pantau servis, kasir, stok, dan keuangan bengkel dari satu tempat.</p>
      <SectionNav tabs={TABS} active="a" label="Contoh tab" />
      <section className={`${panel} grid gap-4`}>
        <h2 className="text-base font-semibold">Tombol</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button><Plus className="size-4" /> Work order</Button>
          <Button variant="outline"><Download className="size-4" /> Ekspor</Button>
          <Button variant="secondary">Sekunder</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Hapus</Button>
          <Button size="sm">Kecil</Button>
          <Button disabled>Nonaktif</Button>
        </div>
      </section>
      <section className={`${panel} grid gap-4 sm:grid-cols-2`}>
        <label className="grid gap-1.5 text-sm font-medium">
          Kendaraan
          <input className={inputClass} placeholder="Cari no. polisi atau pelanggan..." />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Kilometer
          <input className={inputClass} defaultValue="45000" />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <span className={`${chip} bg-brand-blue-soft text-brand-blue-fg`}>Info</span>
          <span className={`${chip} bg-brand-green-soft text-brand-green`}>Lunas</span>
          <span className={`${chip} bg-brand-sand-soft text-brand-sand`}>Piutang</span>
          <span className={`${chip} bg-brand-red-soft text-brand-red`}>Mendesak</span>
          <span className={`${chip} bg-muted text-muted-foreground`}>Draft</span>
        </div>
      </section>
    </main>
  );
}

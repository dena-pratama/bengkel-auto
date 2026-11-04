import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Info, Plus } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { TaxRate } from "@/lib/tax";
import { formatDate } from "@/lib/format";
import { TaxNav } from "@/app/(app)/pajak/_components/ui";
import { cn } from "@/lib/utils";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Pajak", position: "Tax Specialist", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "Tax Admin" }],
  permissions: [],
};

const SAMPLE_RATES: TaxRate[] = [
  {
    id: "rate-1",
    rate_percent: 12,
    dpp_numerator: 11,
    dpp_denominator: 12,
    valid_from: "2025-01-01",
    valid_to: null,
  },
  {
    id: "rate-2",
    rate_percent: 11,
    dpp_numerator: 1,
    dpp_denominator: 1,
    valid_from: "2022-04-01",
    valid_to: "2024-12-31",
  },
];

export default function TaxPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau pajak...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <TaxNav active="settings" />
        <PageHeader
          title="Pengaturan pajak"
          description="Profil usaha, saklar PPN, dan pilihan PPh. Tarif disimpan dengan tanggal berlaku, bukan ditulis di kode."
        />

        <div className="grid gap-5">
          {/* Disclaimer Banner */}
          <div className="flex items-center gap-3 rounded-xl border border-brand-blue/30 bg-brand-blue-soft/50 p-3.5 text-xs text-brand-blue-fg">
            <Info className="size-4 shrink-0 text-brand-blue-fg" />
            <p className="min-w-0">
              Modul ini membantu perhitungan dan pencatatan pajak bengkel secara otomatis. Tarif dan batas omzet dapat disesuaikan tanpa memperbarui sistem inti.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Left Column */}
            <div className="grid content-start gap-5">
              <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
                <h2 className="text-lg font-semibold">Profil usaha</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm font-medium">
                    <span>Bentuk usaha</span>
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      CV / Firma / PT Biasa
                    </div>
                    <span className="text-xs font-normal text-muted-foreground">Menentukan aturan PPh Final yang berlaku.</span>
                  </div>
                  <div className="grid content-end gap-2">
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" defaultChecked className="mt-0.5 size-4 accent-brand-blue-ink" />
                      <span>Bengkel berstatus <strong>PKP</strong> (Pengusaha Kena Pajak)</span>
                    </label>
                  </div>
                </div>
              </section>

              <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
                <h2 className="text-lg font-semibold">PPN</h2>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" defaultChecked className="mt-0.5 size-4 accent-brand-blue-ink" />
                  <span>
                    Hitung PPN di invoice. PPN Keluaran dan Masukan dicatat ke akun terpisah dan tidak mengurangi laba.
                  </span>
                </label>
                <div className="grid gap-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" defaultChecked className="mt-0.5 size-4 accent-brand-blue-ink" />
                    <span>
                      Harga jual sudah termasuk PPN
                      <span className="block text-xs text-muted-foreground">Sistem memecah DPP dan PPN dari harga di nota.</span>
                    </span>
                  </label>
                </div>
              </section>
            </div>

            {/* Right Column */}
            <div className="grid content-start gap-5">
              <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h2 className="text-lg font-semibold">Tarif PPN</h2>
                    <p className="text-xs text-muted-foreground">
                      Default 12% dengan DPP 11/12 (beban efektif 11% untuk barang dan jasa non-mewah).
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    <Plus className="size-3.5" />
                    Tambah tarif
                  </button>
                </div>
                <ul className="grid divide-y divide-border">
                  {SAMPLE_RATES.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                      <span className="w-16 text-lg font-bold tabular-nums text-foreground">{r.rate_percent}%</span>
                      <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                        DPP {r.dpp_numerator}/{r.dpp_denominator} · berlaku {formatDate(r.valid_from)} s/d{" "}
                        {r.valid_to ? formatDate(r.valid_to) : "sekarang"}
                      </span>
                      {!r.valid_to && (
                        <span className="rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green">
                          Berlaku
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={cn(panel, "grid gap-4 p-4 sm:p-5")}>
                <h2 className="text-lg font-semibold">Pajak penghasilan</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm font-medium">
                    <span>Cara menghitung PPh</span>
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      PPh Final PP 23/2018 (0.5% dari omzet)
                    </div>
                  </div>
                  <div className="grid gap-1.5 text-sm font-medium">
                    <span>Tanggal setor tiap bulan</span>
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      15
                    </div>
                    <span className="text-xs font-normal text-muted-foreground">Pengingat setor PPh bulanan.</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5 text-sm font-medium">
                    <span>Tarif PPh Final (%)</span>
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      0.5
                    </div>
                  </div>
                  <div className="grid gap-1.5 text-sm font-medium">
                    <span>Batas omzet setahun (Rp)</span>
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      4.800.000.000
                    </div>
                    <span className="text-xs font-normal text-muted-foreground">Peringatan di 80% dan 95% batas.</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Bukan pengganti konsultan pajak. Konsultasikan dengan pihak berwenang jika membutuhkan kepastian hukum.
            </p>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg bg-brand-rail px-4 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
            >
              Simpan pengaturan
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

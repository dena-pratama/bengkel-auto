import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PageHeader, panel } from "@/components/page-kit";
import { ThemeToggle } from "@/components/topbar-controls";
import { cn } from "@/lib/utils";
import { AvatarEditor, PasswordForm, PhoneForm } from "../../../(app)/pengaturan/_components/profile";
import { SettingsNav } from "../../../(app)/pengaturan/_components/nav";
import { SettingsForm } from "../../../(app)/pengaturan/_settings-form";
import { CropTest } from "./crop-test";
import {
  UserRoundIcon,
  ShieldCheckIcon,
  LockIcon,
  SunMediumIcon,
  InfoIcon,
} from "lucide-react";

// Pratinjau halaman Pengaturan tanpa login, HANYA saat development (404 di production).
export default function PengaturanPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-border/40 py-2.5 sm:flex-row sm:items-center">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs font-semibold text-foreground sm:text-sm">{children}</dd>
    </div>
  );
}

const mockSettings = {
  discount_limit_cashier: 5,
  discount_limit_admin: 15,
  sales_return_max_days: 7,
  opname_pin_threshold: 500000,
  allow_negative_stock: false,
  part_issue_require_scan: true,
  vat_rate_percent: 12,
  pph21_rate_percent: 5,
  pph23_rate_percent: 2,
};

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <SettingsNav active="profile" showShop />
      <PageHeader title="Profil saya" description="Foto, kontak, keamanan akun, dan tampilan aplikasi." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kolom Kiri */}
        <div className="space-y-6">
          {/* Card: Foto profil */}
          <section className={cn(panel, "space-y-5 rounded-2xl p-6 shadow-xs")}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-blue-soft text-brand-blue">
                <UserRoundIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Foto profil</h2>
                <p className="text-xs text-muted-foreground">Foto identitas akun Anda di bengkel.</p>
              </div>
            </div>
            <AvatarEditor employeeId="00000000-0000-0000-0000-000000000000" name="Tama Pratama" photoUrl={null} />
          </section>

          {/* Card: Data akun */}
          <section className={cn(panel, "space-y-5 rounded-2xl p-6 shadow-xs")}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheckIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Data akun</h2>
                <p className="text-xs text-muted-foreground">Informasi personal dan hak akses sistem.</p>
              </div>
            </div>

            <dl className="space-y-0.5">
              <Row label="Nama lengkap">Tama Pratama</Row>
              <Row label="Kode karyawan">
                <span className="font-mono text-xs">EMP-2611-0001</span>
              </Row>
              <Row label="Jabatan">Owner / Kepala Bengkel</Row>
              <Row label="Peran">
                <span className="inline-flex items-center rounded-full bg-brand-blue-soft px-2.5 py-0.5 text-xs font-semibold text-brand-blue">
                  Owner
                </span>
              </Row>
              <Row label="Email login">pratamajuara09@gmail.com</Row>
              <Row label="Cabang">Bengkel Pusat Bandung</Row>
              <Row label="Tanggal masuk">15 Januari 2024</Row>
            </dl>

            <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-brand-blue" />
              <span>Nama, jabatan, dan peran hanya dapat diubah oleh Owner di menu Karyawan.</span>
            </div>

            <div className="pt-2">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Perbarui Kontak</h3>
              <PhoneForm initial="081234567890" />
            </div>
          </section>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-6">
          {/* Card: Keamanan */}
          <section className={cn(panel, "space-y-6 rounded-2xl p-6 shadow-xs")}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <LockIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Keamanan</h2>
                <p className="text-xs text-muted-foreground">Kata sandi dan PIN otorisasi transaksi.</p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Ganti password</h3>
              <PasswordForm />
            </div>
          </section>

          {/* Card: Tampilan */}
          <section className={cn(panel, "space-y-4 rounded-2xl p-6 shadow-xs")}>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <SunMediumIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Tampilan</h2>
                <p className="text-xs text-muted-foreground">Mode terang atau gelap. Pilihan disimpan di perangkat ini.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
              <div>
                <span className="text-sm font-semibold text-foreground">Tema Aplikasi</span>
                <p className="text-xs text-muted-foreground">Beralih antara tema Terang dan Gelap.</p>
              </div>
              <ThemeToggle />
            </div>
          </section>

          <CropTest />
        </div>
      </div>

      {/* Pratinjau Pengaturan Bengkel */}
      <div className="border-t border-border pt-8">
        <PageHeader title="Pengaturan Bengkel" description="Batas dan aturan operasional bengkel (Pratinjau visual)." />
        <div className="mt-6">
          <SettingsForm initial={mockSettings} readOnly={false} />
        </div>
      </div>
    </main>
  );
}

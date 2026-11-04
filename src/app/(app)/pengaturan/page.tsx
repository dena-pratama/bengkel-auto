import { Suspense } from "react";
import { PageHeader, Skeleton, panel } from "@/components/page-kit";
import { ThemeToggle } from "@/components/topbar-controls";
import { can, requireUser } from "@/lib/auth";
import { employeeHasPin, getEmployee } from "@/lib/employees";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PinSection } from "../karyawan/_components/employee-sections";
import { AvatarEditor, PasswordForm, PhoneForm } from "./_components/profile";
import { SettingsNav } from "./_components/nav";
import {
  UserRoundIcon,
  ShieldCheckIcon,
  LockIcon,
  SunMediumIcon,
  InfoIcon,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
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

async function Content() {
  const ctx = await requireUser();
  const [employee, hasPin] = await Promise.all([getEmployee(ctx.employee.id), employeeHasPin(ctx.employee.id)]);
  const showShop = can(ctx, "settings", "view", false) || can(ctx, "settings", "update", false);

  return (
    <>
      <SettingsNav active="profile" showShop={showShop} />
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
            <AvatarEditor employeeId={ctx.employee.id} name={ctx.employee.full_name} photoUrl={employee?.photo_url ?? ctx.employee.photo_url} />
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
              <Row label="Nama lengkap">{ctx.employee.full_name}</Row>
              <Row label="Kode karyawan">
                <span className="font-mono text-xs">{ctx.employee.code}</span>
              </Row>
              <Row label="Jabatan">{ctx.employee.position ?? "-"}</Row>
              <Row label="Peran">
                <span className="inline-flex items-center rounded-full bg-brand-blue-soft px-2.5 py-0.5 text-xs font-semibold text-brand-blue">
                  {ctx.roles.map((r) => r.name).join(", ") || "-"}
                </span>
              </Row>
              <Row label="Email login">{employee?.email ?? "-"}</Row>
              <Row label="Cabang">{ctx.branch.name}</Row>
              {employee?.hire_date && <Row label="Tanggal masuk">{formatDate(employee.hire_date)}</Row>}
            </dl>

            <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-brand-blue" />
              <span>Nama, jabatan, dan peran hanya dapat diubah oleh Owner di menu Karyawan.</span>
            </div>

            <div className="pt-2">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Perbarui Kontak</h3>
              <PhoneForm initial={employee?.phone ?? ""} />
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

            <div className="space-y-3 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">PIN persetujuan</h3>
              <PinSection hasPin={hasPin} />
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
        </div>
      </div>
    </>
  );
}

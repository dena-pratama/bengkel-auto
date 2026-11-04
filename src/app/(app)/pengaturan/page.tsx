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

export default function SettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[900px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-words">{children}</dd>
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

      <section className={cn(panel, "grid gap-5")}>
        <h2 className="text-lg font-semibold">Foto profil</h2>
        <AvatarEditor employeeId={ctx.employee.id} name={ctx.employee.full_name} photoUrl={employee?.photo_url ?? ctx.employee.photo_url} />
      </section>

      <section className={cn(panel, "grid gap-5")}>
        <h2 className="text-lg font-semibold">Data akun</h2>
        <dl className="grid gap-3">
          <Row label="Nama">{ctx.employee.full_name}</Row>
          <Row label="Kode karyawan">
            <span className="font-mono">{ctx.employee.code}</span>
          </Row>
          <Row label="Jabatan">{ctx.employee.position ?? "-"}</Row>
          <Row label="Peran">{ctx.roles.map((r) => r.name).join(", ") || "-"}</Row>
          <Row label="Email login">{employee?.email ?? "-"}</Row>
          <Row label="Cabang">{ctx.branch.name}</Row>
          {employee?.hire_date && <Row label="Tanggal masuk">{formatDate(employee.hire_date)}</Row>}
        </dl>
        <p className="text-xs text-muted-foreground">Nama, jabatan, dan peran diubah oleh Owner di menu Karyawan.</p>
        <PhoneForm initial={employee?.phone ?? ""} />
      </section>

      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">Keamanan</h2>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Ganti password</h3>
          <PasswordForm />
        </div>
        <div className="grid gap-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">PIN persetujuan</h3>
          <PinSection hasPin={hasPin} />
        </div>
      </section>

      <section className={cn(panel, "flex flex-wrap items-center justify-between gap-3")}>
        <div>
          <h2 className="text-lg font-semibold">Tampilan</h2>
          <p className="text-sm text-muted-foreground">Mode terang atau gelap. Pilihan disimpan di perangkat ini.</p>
        </div>
        <ThemeToggle />
      </section>
    </>
  );
}

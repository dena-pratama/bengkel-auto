import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { listPayProfiles } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import { PayProfileDialog } from "../_components/forms";
import { PayrollNav } from "../_components/ui";

export default function ProfilesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "payroll", "view", false)) return <NoAccess />;
  const profiles = await listPayProfiles();
  const set = profiles.filter((p) => p.pay_type).length;
  const canEdit = can(ctx, "payroll", "update", false);

  return (
    <>
      <PayrollNav active="profiles" showAll />
      <PageHeader title="Profil gaji" description={`${set} dari ${profiles.length} karyawan sudah punya profil gaji`} />
      <section className={cn(panel, "p-4 sm:p-5")}>
        <ul className="grid divide-y divide-border">
          {profiles.map((p) => (
            <li key={p.employee_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.code} · {p.position ?? "Tanpa jabatan"}
                  {p.fixed_allowances.length > 0 && ` · tunjangan ${p.fixed_allowances.map((a) => `${a.name} ${formatRupiah(a.amount)}`).join(", ")}`}
                </p>
              </div>
              {p.pay_type ? (
                <span className="text-sm font-semibold tabular-nums">
                  {formatRupiah(p.base_salary)}
                  <span className="text-xs font-normal text-muted-foreground">{p.pay_type === "daily" ? " / hari" : " / bulan"}</span>
                </span>
              ) : (
                <span className="rounded-full bg-brand-sand-soft px-2.5 py-0.5 text-xs font-medium">Belum diatur</span>
              )}
              {canEdit && <PayProfileDialog profile={p} />}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

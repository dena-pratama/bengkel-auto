import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Crown, ShieldCheck, Users } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { listPermissions, listRoles } from "@/lib/employees";
import { NewRoleDialog } from "../_components/dialogs";
import { cn } from "@/lib/utils";
import { NoAccess, PageHeader, SectionTabs, panel } from "../_components/ui";

export default function RolesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <SectionTabs active="roles" />
      <Suspense fallback={<div className={`${panel} h-80 animate-pulse`} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "employees", "view", false)) return <NoAccess />;
  const canEdit = can(ctx, "employees", "update", false);
  const [roles, permissions] = await Promise.all([listRoles(), canEdit ? listPermissions() : Promise.resolve([])]);

  return (
    <>
      <PageHeader
        title="Role & hak akses"
        description="Satu karyawan boleh punya lebih dari satu role; izinnya digabung."
        actions={
          canEdit && <NewRoleDialog permissions={permissions} />
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <li key={r.id}>
            <Link
              href={`/karyawan/role/${r.id}`}
              className={cn(panel, "flex h-full items-start gap-3 transition-shadow hover:shadow-lg", !r.is_active && "opacity-60")}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-sm",
                  r.is_superuser ? "bg-brand-red text-white" : "bg-brand-blue-soft text-brand-blue-fg",
                )}
              >
                {r.is_superuser ? <Crown className="size-5" /> : <ShieldCheck className="size-5" />}
              </span>
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.name}</span>
                  {r.is_system && <span className="rounded-sm bg-muted px-1.5 py-0.5 text-2xs">Bawaan</span>}
                  {!r.is_active && <span className="rounded-sm bg-brand-red-soft px-1.5 py-0.5 text-2xs text-brand-red">Nonaktif</span>}
                </span>
                {r.description && <span className="text-sm text-muted-foreground">{r.description}</span>}
                <span className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" /> {r.member_count} karyawan
                  </span>
                  <span>{r.is_superuser ? "Semua izin" : `${r.permission_count} izin`}</span>
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

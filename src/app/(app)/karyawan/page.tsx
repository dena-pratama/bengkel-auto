import { Suspense } from "react";
import { Key, UserCheck, Users, Wrench } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { listEmployees, listRoles } from "@/lib/employees";
import { cn } from "@/lib/utils";
import { NewEmployeeDialog } from "./_components/dialogs";
import { EmployeesTable } from "./_components/employees-table";
import { NoAccess, PageHeader, SectionTabs, panel } from "./_components/ui";

export default function EmployeesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <SectionTabs active="employees" />
      <Suspense fallback={<div className={`${panel} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "employees", "view", false)) return <NoAccess />;
  const canCreate = can(ctx, "employees", "create", false);
  const [employees, roles] = await Promise.all([listEmployees(), canCreate ? listRoles() : Promise.resolve([])]);

  const active = employees.filter((e) => e.status === "active").length;
  const onLeave = employees.filter((e) => e.status === "on_leave").length;
  const mechanics = employees.filter(
    (e) => /mekanik/i.test(e.position ?? "") || e.roles.some((r) => /mekanik/i.test(r.name))
  ).length;
  const withLogin = employees.filter((e) => Boolean(e.email)).length;
  const managementRoles = roles.filter((r) => r.is_superuser || /admin|manajer|owner/i.test(r.name)).length;

  return (
    <>
      <PageHeader
        title="Karyawan"
        description={`${employees.length} staf terdaftar · ${active} aktif${onLeave > 0 ? ` · ${onLeave} cuti` : ""}`}
        actions={
          canCreate && <NewEmployeeDialog roles={roles.filter((r) => r.is_active)} canAssignOwner={ctx.is_superuser} />
        }
      />

      {/* 4 Summary Stat Cards matching Figma 08 · Karyawan */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
            <Users className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total karyawan</p>
            <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">{employees.length}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {managementRoles > 0 ? `${managementRoles} role manajemen` : "Semua staf"}
            </p>
          </div>
        </div>

        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
            <UserCheck className="size-5 text-brand-green" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Aktif hari ini</p>
            <p className="text-lg font-semibold leading-tight tabular-nums text-brand-green sm:text-xl">{active}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {onLeave > 0 ? `${onLeave} sedang cuti` : "Semua bertugas"}
            </p>
          </div>
        </div>

        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
            <Wrench className="size-5 text-brand-sand" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Mekanik</p>
            <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">{mechanics}</p>
            <p className="truncate text-[11px] text-muted-foreground">siap mengerjakan WO</p>
          </div>
        </div>

        <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted">
            <Key className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Akun login</p>
            <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">{withLogin}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {withLogin === employees.length ? "semua terhubung" : `${withLogin} dari ${employees.length} terhubung`}
            </p>
          </div>
        </div>
      </section>

      <EmployeesTable employees={employees} />
    </>
  );
}

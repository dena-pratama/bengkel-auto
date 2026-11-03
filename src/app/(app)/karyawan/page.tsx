import { Suspense } from "react";
import { can, requireUser } from "@/lib/auth";
import { listEmployees, listRoles } from "@/lib/employees";
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

  return (
    <>
      <PageHeader
        title="Karyawan"
        description={`${employees.length} karyawan · ${active} aktif`}
        actions={
          canCreate && <NewEmployeeDialog roles={roles.filter((r) => r.is_active)} canAssignOwner={ctx.is_superuser} />
        }
      />
      <EmployeesTable employees={employees} />
    </>
  );
}

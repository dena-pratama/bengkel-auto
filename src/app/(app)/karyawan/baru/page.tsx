import { Suspense } from "react";
import { can, requireUser } from "@/lib/auth";
import { listRoles } from "@/lib/employees";
import { CreateEmployeeForm } from "../_components/employee-form";
import { NoAccess, PageHeader, panel } from "../_components/ui";

export default function NewEmployeePage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <PageHeader title="Tambah karyawan" back={{ href: "/karyawan", label: "Karyawan" }} />
      <Suspense fallback={<div className={`${panel} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "employees", "create", false)) return <NoAccess />;
  const roles = (await listRoles()).filter((r) => r.is_active);
  return <CreateEmployeeForm roles={roles} canAssignOwner={ctx.is_superuser} />;
}

import { Suspense } from "react";
import { can, requireUser } from "@/lib/auth";
import { listPermissions } from "@/lib/employees";
import { RoleForm } from "../../_components/role-form";
import { NoAccess, PageHeader, panel } from "../../_components/ui";

export default function NewRolePage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <PageHeader title="Tambah role" back={{ href: "/karyawan/role", label: "Role & hak akses" }} />
      <Suspense fallback={<div className={`${panel} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "employees", "update", false)) return <NoAccess />;
  return <RoleForm role={null} permissions={await listPermissions()} />;
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { can, requireUser } from "@/lib/auth";
import { getRole, listPermissions } from "@/lib/employees";
import { RoleForm } from "../../_components/role-form";
import { NoAccess, PageHeader, panel } from "../../_components/ui";

export default function RoleDetailPage({ params }: PageProps<"/karyawan/role/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Suspense fallback={<div className={`${panel} h-96 animate-pulse`} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "employees", "view", false)) return <NoAccess />;

  const [role, permissions] = await Promise.all([getRole(id), listPermissions()]);
  if (!role) notFound();
  const readOnly = !can(ctx, "employees", "update", false);

  return (
    <>
      <PageHeader
        title={role.name}
        description={role.is_superuser ? "Role Owner: semua izin, tidak bisa diubah." : role.description ?? undefined}
        back={{ href: "/karyawan/role", label: "Role & hak akses" }}
      />
      <RoleForm
        key={role.id}
        permissions={permissions}
        readOnly={readOnly}
        role={{
          ...role,
          grants: Object.fromEntries(role.permissions.map((p) => [p.permission_id, p.scope])),
        }}
      />
    </>
  );
}

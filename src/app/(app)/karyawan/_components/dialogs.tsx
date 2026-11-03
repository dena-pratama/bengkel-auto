"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog, useCreateDialog } from "@/components/form-dialog";
import type { Permission } from "@/lib/employees";
import { CreateEmployeeForm } from "./employee-form";
import { RoleForm } from "./role-form";
import type { RoleOption } from "./role-picker";

export function NewEmployeeDialog({ roles, canAssignOwner }: { roles: RoleOption[]; canAssignOwner: boolean }) {
  const d = useCreateDialog({ message: "Karyawan ditambahkan.", detailHref: (id) => `/karyawan/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah karyawan
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah karyawan" description="Data diri, role, dan akun login (opsional)." size="xl">
        <CreateEmployeeForm roles={roles} canAssignOwner={canAssignOwner} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

export function NewRoleDialog({ permissions }: { permissions: Permission[] }) {
  const d = useCreateDialog({ message: "Role dibuat.", detailHref: (id) => `/karyawan/role/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah role
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah role" description="Atur nama role dan hak akses per modul." size="xl">
        <RoleForm role={null} permissions={permissions} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

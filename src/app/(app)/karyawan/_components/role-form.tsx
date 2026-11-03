"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import type { Permission } from "@/lib/employees";
import {
  ACTION_LABEL,
  OWN_SCOPE_ACTIONS,
  PERMISSION_ACTIONS,
  roleSchema,
  type PermissionActionKey,
  type RoleInput,
} from "@/lib/validation/employee";
import { cn } from "@/lib/utils";
import { saveRoleAction, setRoleActiveAction } from "../actions";
import { inputClass, panel } from "./ui";

type Scope = "all" | "own";
type Grants = Record<string, Scope>; // permission_id → lingkup

type ModuleRow = { module: string; label: string; cells: Partial<Record<PermissionActionKey, string>> };

function groupModules(permissions: Permission[]): ModuleRow[] {
  const map = new Map<string, ModuleRow>();
  for (const p of permissions) {
    const row = map.get(p.module) ?? { module: p.module, label: p.module_label, cells: {} };
    row.cells[p.action] = p.id;
    map.set(p.module, row);
  }
  return [...map.values()];
}

/** Sel matriks: kosong → semua data → hanya data sendiri (untuk Lihat/Ubah) → kosong */
function Cell({
  action,
  scope,
  onChange,
  disabled,
}: {
  action: PermissionActionKey;
  scope: Scope | undefined;
  onChange: (s: Scope | undefined) => void;
  disabled?: boolean;
}) {
  const allowOwn = OWN_SCOPE_ACTIONS.includes(action);
  const next = () => onChange(scope === undefined ? "all" : scope === "all" && allowOwn ? "own" : undefined);
  const label = scope === "all" ? "semua data" : scope === "own" ? "hanya data sendiri" : "tidak diizinkan";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={next}
      aria-label={`${ACTION_LABEL[action]}: ${label}`}
      title={`${ACTION_LABEL[action]}: ${label}`}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed",
        scope === "all" && "border-brand-blue-ink bg-brand-blue-ink text-white",
        scope === "own" && "border-brand-blue bg-brand-blue-soft text-brand-blue-fg",
        !scope && "border-border bg-card text-transparent hover:border-brand-blue/60",
      )}
    >
      {scope === "own" ? <User className="size-4" /> : <Check className="size-4" />}
    </button>
  );
}

export function RoleForm({
  role,
  permissions,
  readOnly = false,
}: {
  role: { id: string; name: string; description: string | null; is_system: boolean; is_superuser: boolean; is_active: boolean; grants: Grants } | null;
  permissions: Permission[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const modules = useMemo(() => groupModules(permissions), [permissions]);
  const [grants, setGrants] = useState<Grants>(role?.grants ?? {});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const isOwnerRole = role?.is_superuser ?? false;
  const locked = isOwnerRole || readOnly;

  const { register, handleSubmit, formState } = useForm<Omit<RoleInput, "permissions">>({
    resolver: zodResolver(roleSchema.omit({ permissions: true })),
    defaultValues: { name: role?.name ?? "", description: role?.description ?? "" },
  });

  const setCell = (id: string, scope: Scope | undefined) =>
    setGrants((g) => {
      const copy = { ...g };
      if (scope) copy[id] = scope;
      else delete copy[id];
      return copy;
    });

  const setRow = (row: ModuleRow, on: boolean) =>
    setGrants((g) => {
      const copy = { ...g };
      for (const id of Object.values(row.cells)) {
        if (!id) continue;
        if (on) copy[id] = "all";
        else delete copy[id];
      }
      return copy;
    });

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveRoleAction(role?.id ?? null, {
        ...values,
        permissions: Object.entries(grants).map(([permission_id, scope]) => ({ permission_id, scope })),
      });
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (!role) return router.push(`/karyawan/role/${result.data.id}`);
      setMessage({ ok: true, text: "Role tersimpan." });
      router.refresh();
    });
  });

  const toggleActive = () =>
    startTransition(async () => {
      if (!role) return;
      const result = await setRoleActiveAction(role.id, !role.is_active);
      setMessage(result.ok ? { ok: true, text: role.is_active ? "Role dinonaktifkan." : "Role diaktifkan." } : { ok: false, text: result.error });
      router.refresh();
    });

  const granted = Object.keys(grants).length;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <section className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
        <FormField id="role_name" label="Nama role *" disabled={locked} error={formState.errors.name?.message} {...register("name")} />
        <div className="grid gap-1.5">
          <label htmlFor="role_desc" className="text-sm font-medium">
            Deskripsi
          </label>
          <input id="role_desc" disabled={locked} className={inputClass} placeholder="Tugas utama role ini" {...register("description")} />
        </div>
      </section>

      <section className={cn(panel, "grid gap-3 p-0 sm:p-0")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div>
            <h2 className="text-lg font-semibold">Hak akses per modul</h2>
            <p className="text-sm text-muted-foreground">
              {isOwnerRole
                ? "Owner selalu punya semua izin, termasuk modul baru."
                : readOnly
                  ? `${granted} izin. Anda hanya bisa melihat.`
                  : `${granted} izin dipilih. Klik kotak untuk mengubah.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-sm bg-brand-blue-ink text-white">
                <Check className="size-3" />
              </span>
              Semua data
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-sm border border-brand-blue bg-brand-blue-soft text-brand-blue-fg">
                <User className="size-3" />
              </span>
              Hanya data sendiri
            </span>
          </div>
        </div>

        <div className="overflow-x-auto px-2 pb-2 sm:px-3">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-medium">Modul</th>
                {PERMISSION_ACTIONS.map((a) => (
                  <th key={a} className="px-1 py-2 text-center font-medium">
                    {ACTION_LABEL[a]}
                  </th>
                ))}
                {!locked && <th className="px-2 py-2 text-right font-medium">Baris</th>}
              </tr>
            </thead>
            <tbody>
              {modules.map((row) => {
                const ids = Object.values(row.cells).filter(Boolean) as string[];
                const full = ids.every((id) => grants[id] === "all");
                return (
                  <tr key={row.module} className="border-t border-border/60">
                    <td className="sticky left-0 z-10 max-w-56 bg-card px-2 py-2 font-medium">{row.label}</td>
                    {PERMISSION_ACTIONS.map((a) => {
                      const id = row.cells[a];
                      return (
                        <td key={a} className="px-1 py-1.5">
                          <div className="flex justify-center">
                            {id && <Cell action={a} scope={isOwnerRole ? "all" : grants[id]} onChange={(s) => setCell(id, s)} disabled={locked || pending} />}
                          </div>
                        </td>
                      );
                    })}
                    {!locked && (
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setRow(row, !full)}
                          className="rounded-sm px-2 py-1 text-xs font-medium text-brand-blue-fg hover:bg-brand-blue-soft"
                        >
                          {full ? "Kosongkan" : "Semua"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : role ? "Simpan role" : "Buat role"}
          </Button>
          <Button variant="outline" render={<Link href="/karyawan/role" />}>
            Kembali
          </Button>
          {role && !role.is_system && (
            <Button type="button" variant="outline" disabled={pending} onClick={toggleActive} className="sm:ml-auto">
              {role.is_active ? "Nonaktifkan role" : "Aktifkan role"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormError, FormField } from "@/components/form-field";
import {
  createEmployeeSchema,
  emptyEmployee,
  employeeSchema,
  type CreateEmployeeInput,
  type EmployeeInput,
} from "@/lib/validation/employee";
import { cn } from "@/lib/utils";
import { createEmployeeAction, updateEmployeeAction } from "../actions";
import { RolePicker, type RoleOption } from "./role-picker";
import { panel } from "./ui";

function EmployeeFields({
  register,
  errors,
}: {
  register: UseFormRegister<EmployeeInput>;
  errors: FieldErrors<EmployeeInput>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField id="full_name" label="Nama lengkap *" autoComplete="off" error={errors.full_name?.message} {...register("full_name")} />
      </div>
      <FormField id="position" label="Jabatan" placeholder="mis. Mekanik senior" error={errors.position?.message} {...register("position")} />
      <FormField id="hire_date" label="Tanggal masuk" type="date" error={errors.hire_date?.message} {...register("hire_date")} />
      <FormField id="phone" label="Nomor HP" type="tel" inputMode="tel" placeholder="0812xxxxxxx" error={errors.phone?.message} {...register("phone")} />
      <FormField id="nik" label="NIK (opsional)" inputMode="numeric" placeholder="16 digit" error={errors.nik?.message} {...register("nik")} />
      <p className="text-sm font-medium sm:col-span-2">Rekening bank (untuk gaji)</p>
      <FormField id="bank_name" label="Bank" placeholder="mis. BCA" error={errors.bank_name?.message} {...register("bank_name")} />
      <FormField
        id="bank_account_number"
        label="Nomor rekening"
        inputMode="numeric"
        error={errors.bank_account_number?.message}
        {...register("bank_account_number")}
      />
      <div className="sm:col-span-2">
        <FormField id="bank_account_name" label="Nama pemilik rekening" error={errors.bank_account_name?.message} {...register("bank_account_name")} />
      </div>
    </div>
  );
}

/** Form tambah karyawan: data diri + role + (opsional) akun login. */
export function CreateEmployeeForm({ roles, canAssignOwner }: { roles: RoleOption[]; canAssignOwner: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ id: string; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { ...emptyEmployee, role_ids: [], create_account: false, email: "", password: "", confirm_password: "" },
  });
  const createAccount = useWatch({ control, name: "create_account" });
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await createEmployeeAction(values);
      if (!result.ok) return setServerError(result.error);
      if (result.data.warning) return setWarning({ id: result.data.id, text: result.data.warning });
      router.push(`/karyawan/${result.data.id}`);
    });
  });

  if (warning) {
    return (
      <section className={cn(panel, "grid gap-3")}>
        <FormError message={warning.text} />
        <p className="text-sm text-muted-foreground">Akun login bisa dibuat nanti dari halaman detail karyawan.</p>
        <Button nativeButton={false} render={<Link href={`/karyawan/${warning.id}`} />} className="w-fit">
          Buka detail karyawan
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" noValidate>
      <section className={cn(panel, "grid gap-4")}>
        <h2 className="text-lg font-semibold">Data karyawan</h2>
        <EmployeeFields register={register as unknown as UseFormRegister<EmployeeInput>} errors={errors} />
      </section>

      <div className="grid content-start gap-4">
        <section className={panel}>
          <Controller
            control={control}
            name="role_ids"
            render={({ field }) => (
              <RolePicker roles={roles} value={field.value} onChange={field.onChange} canAssignOwner={canAssignOwner} error={errors.role_ids?.message} />
            )}
          />
        </section>

        <section className={cn(panel, "grid gap-4")}>
          <Controller
            control={control}
            name="create_account"
            render={({ field }) => (
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Buat akun login sekarang</span>
                  <span className="block text-xs text-muted-foreground">Karyawan masuk dengan email &amp; password ini.</span>
                </span>
              </label>
            )}
          />
          {createAccount && (
            <div className="grid gap-4">
              <FormField id="email" label="Email *" type="email" autoComplete="off" error={errors.email?.message} {...register("email")} />
              <FormField id="password" label="Password *" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
              <FormField
                id="confirm_password"
                label="Ulangi password *"
                type="password"
                autoComplete="new-password"
                error={errors.confirm_password?.message}
                {...register("confirm_password")}
              />
            </div>
          )}
        </section>

        <FormError message={serverError} />
        <div className="flex gap-2">
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
            {pending ? "Menyimpan..." : "Simpan karyawan"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/karyawan" />}>
            Batal
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Form ubah data diri karyawan. */
export function EditEmployeeForm({ id, defaults, readOnly }: { id: string; defaults: EmployeeInput; readOnly: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState, reset } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateEmployeeAction(id, values);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      reset(values);
      setMessage({ ok: true, text: "Data karyawan tersimpan." });
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <fieldset disabled={readOnly || pending} className="grid gap-4">
        <EmployeeFields register={register} errors={formState.errors} />
      </fieldset>
      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
      {!readOnly && (
        <Button type="submit" disabled={pending || !formState.isDirty} className="w-fit">
          {pending ? "Menyimpan..." : "Simpan perubahan"}
        </Button>
      )}
    </form>
  );
}

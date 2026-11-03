"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import {
  EMPLOYEE_STATUS,
  STATUS_LABEL,
  accountSchema,
  passwordResetSchema,
  pinSchema,
  statusSchema,
  type AccountInput,
  type EmployeeStatus,
  type PasswordResetInput,
  type PinInput,
  type StatusInput,
} from "@/lib/validation/employee";
import { cn } from "@/lib/utils";
import {
  createAccountAction,
  resetPasswordAction,
  setEmployeeRolesAction,
  setEmployeeStatusAction,
  setMyPinAction,
  type ActionResult,
} from "../actions";
import { RolePicker, type RoleOption } from "./role-picker";
import { inputClass } from "./ui";

type Message = { ok: boolean; text: string } | null;

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />;
}

/** Jalankan server action, tampilkan hasil, segarkan data halaman. */
function useAction() {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, success: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      setMessage({ ok: true, text: success });
      after?.();
      router.refresh();
    });
  };
  return { message, pending, run };
}

export function RolesSection({
  employeeId,
  roles,
  current,
  canAssignOwner,
  readOnly,
}: {
  employeeId: string;
  roles: RoleOption[];
  current: string[];
  canAssignOwner: boolean;
  readOnly: boolean;
}) {
  const [value, setValue] = useState(current);
  const { message, pending, run } = useAction();
  const dirty = value.length !== current.length || value.some((v) => !current.includes(v));

  return (
    <div className="grid gap-3">
      <RolePicker roles={roles} value={value} onChange={setValue} canAssignOwner={canAssignOwner} disabled={readOnly || pending} />
      <Feedback message={message} />
      {!readOnly && (
        <Button
          className="w-fit"
          disabled={pending || !dirty || value.length === 0}
          onClick={() => run(() => setEmployeeRolesAction(employeeId, { role_ids: value }), "Role tersimpan.")}
        >
          {pending ? "Menyimpan..." : "Simpan role"}
        </Button>
      )}
    </div>
  );
}

export function StatusSection({ employeeId, status, isSelf }: { employeeId: string; status: EmployeeStatus; isSelf: boolean }) {
  const { message, pending, run } = useAction();
  const { register, handleSubmit, control, formState, reset } = useForm<StatusInput>({
    resolver: zodResolver(statusSchema),
    defaultValues: { status, reason: "" },
  });
  const next = useWatch({ control, name: "status" });

  if (isSelf) {
    return <p className="text-sm text-muted-foreground">Status akun sendiri tidak bisa diubah. Minta Owner lain jika perlu.</p>;
  }

  const onSubmit = handleSubmit((values) =>
    run(() => setEmployeeStatusAction(employeeId, values), "Status diperbarui.", () => reset({ status: values.status, reason: "" })),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <div className="grid gap-1.5">
        <label htmlFor="status" className="text-sm font-medium">
          Status baru
        </label>
        <select id="status" className={inputClass} {...register("status")}>
          {EMPLOYEE_STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="reason" className="text-sm font-medium">
          Alasan {next === "inactive" ? "*" : "(opsional)"}
        </label>
        <textarea
          id="reason"
          rows={2}
          aria-invalid={Boolean(formState.errors.reason)}
          placeholder={next === "inactive" ? "mis. Resign per 30 Nov" : "mis. Cuti tahunan"}
          className={cn(inputClass, "h-auto py-2")}
          {...register("reason")}
        />
        {formState.errors.reason && <p className="text-xs text-destructive">{formState.errors.reason.message}</p>}
      </div>
      {next === "inactive" && status !== "inactive" && (
        <p className="rounded-sm bg-brand-red-soft px-3 py-2 text-xs text-brand-red">
          Akun login karyawan ini akan langsung diblokir. Riwayat transaksinya tetap tersimpan.
        </p>
      )}
      <Feedback message={message} />
      <Button type="submit" className="w-fit" disabled={pending || next === status}>
        {pending ? "Menyimpan..." : "Ubah status"}
      </Button>
    </form>
  );
}

export function AccountSection({ employeeId, email, readOnly }: { employeeId: string; email: string | null; readOnly: boolean }) {
  const { message, pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const create = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: { email: "", password: "", confirm_password: "" },
  });
  const reset = useForm<PasswordResetInput>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  if (email) {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm">
          <KeyRound className="size-4 text-muted-foreground" />
          <span className="truncate font-medium">{email}</span>
        </p>
        {!readOnly &&
          (open ? (
            <form
              noValidate
              className="grid gap-3"
              onSubmit={reset.handleSubmit((v) =>
                run(() => resetPasswordAction(employeeId, v), "Password baru tersimpan. Sampaikan ke karyawan secara langsung.", () => {
                  reset.reset();
                  setOpen(false);
                }),
              )}
            >
              <FormField id="new_password" label="Password baru" type="password" autoComplete="new-password" error={reset.formState.errors.password?.message} {...reset.register("password")} />
              <FormField
                id="new_password_confirm"
                label="Ulangi password baru"
                type="password"
                autoComplete="new-password"
                error={reset.formState.errors.confirm_password?.message}
                {...reset.register("confirm_password")}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? "Menyimpan..." : "Simpan password"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
              Atur ulang password
            </Button>
          ))}
        <Feedback message={message} />
      </div>
    );
  }

  if (readOnly) return <p className="text-sm text-muted-foreground">Belum punya akun login.</p>;

  return (
    <form
      noValidate
      className="grid gap-3"
      onSubmit={create.handleSubmit((v) => run(() => createAccountAction(employeeId, v), "Akun login dibuat."))}
    >
      <p className="text-sm text-muted-foreground">Belum punya akun login. Buat agar karyawan bisa masuk ke aplikasi.</p>
      <FormField id="acc_email" label="Email" type="email" autoComplete="off" error={create.formState.errors.email?.message} {...create.register("email")} />
      <FormField id="acc_password" label="Password" type="password" autoComplete="new-password" error={create.formState.errors.password?.message} {...create.register("password")} />
      <FormField
        id="acc_password_confirm"
        label="Ulangi password"
        type="password"
        autoComplete="new-password"
        error={create.formState.errors.confirm_password?.message}
        {...create.register("confirm_password")}
      />
      <Feedback message={message} />
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Membuat..." : "Buat akun login"}
      </Button>
    </form>
  );
}

export function PinSection({ hasPin }: { hasPin: boolean }) {
  const { message, pending, run } = useAction();
  const { register, handleSubmit, formState, reset } = useForm<PinInput>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: "", confirm_pin: "" },
  });

  return (
    <form noValidate className="grid gap-3" onSubmit={handleSubmit((v) => run(() => setMyPinAction(v), "PIN tersimpan.", () => reset()))}>
      <p className="text-sm text-muted-foreground">
        {hasPin ? "PIN sudah diatur. Isi di bawah untuk menggantinya." : "PIN 6 digit dipakai untuk menyetujui aksi sensitif di kasir."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="pin" label="PIN baru" type="password" inputMode="numeric" maxLength={6} autoComplete="off" error={formState.errors.pin?.message} {...register("pin")} />
        <FormField
          id="confirm_pin"
          label="Ulangi PIN"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoComplete="off"
          error={formState.errors.confirm_pin?.message}
          {...register("confirm_pin")}
        />
      </div>
      <Feedback message={message} />
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Menyimpan..." : hasPin ? "Ganti PIN" : "Atur PIN"}
      </Button>
    </form>
  );
}

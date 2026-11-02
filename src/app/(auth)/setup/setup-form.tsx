"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { setupOwnerSchema, type SetupOwnerInput } from "@/lib/validation/auth";
import { setupOwnerAction } from "../actions";

export function SetupForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<SetupOwnerInput>({
    resolver: zodResolver(setupOwnerSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors } = formState;

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await setupOwnerAction(values);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormError message={serverError} />
      <FormField id="fullName" label="Nama lengkap" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
      <FormField id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="Minimal 8 karakter"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormField
        id="confirmPassword"
        label="Ulangi password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Buat akun Owner"}
      </Button>
    </form>
  );
}

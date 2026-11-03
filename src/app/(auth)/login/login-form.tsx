"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginAction } from "../actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {notice && (
        <p className="rounded-md border border-brand-sand bg-brand-sand-soft px-3 py-2 text-sm text-foreground">{notice}</p>
      )}
      <FormError message={serverError} />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="nama@bengkel.com"
        error={formState.errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={formState.errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}

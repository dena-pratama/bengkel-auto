"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/form-field";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginAction } from "../actions";

const REMEMBER_KEY = "bk_login_email";

const fieldClass =
  "h-[50px] w-full rounded-xl border border-input bg-muted/40 px-4 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-brand-red";

export function LoginForm({ notice }: { notice?: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, setValue, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // "Ingat email saya": isi email dari penyimpanan browser (hanya email, bukan password)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      const box = document.getElementById("remember") as HTMLInputElement | null;
      if (saved && box) {
        box.checked = true;
        setValue("email", saved);
      }
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, [setValue]);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    try {
      if ((document.getElementById("remember") as HTMLInputElement | null)?.checked) localStorage.setItem(REMEMBER_KEY, values.email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* abaikan */
    }
    startTransition(async () => {
      const result = await loginAction(values);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  const emailError = formState.errors.email?.message;
  const passwordError = formState.errors.password?.message;

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      {notice && <p className="rounded-xl border border-brand-sand/40 bg-brand-sand-soft px-3 py-2 text-sm text-brand-sand">{notice}</p>}
      <FormError message={serverError} />

      <div className="grid gap-2">
        <label htmlFor="email" className="text-[13px] font-medium">
          Email
        </label>
        <input id="email" type="email" autoComplete="email" placeholder="nama@email.com" aria-invalid={Boolean(emailError)} className={fieldClass} {...register("email")} />
        {emailError && <p className="text-xs text-brand-red">{emailError}</p>}
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-[13px] font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan password"
            aria-invalid={Boolean(passwordError)}
            className={`${fieldClass} pr-20`}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-4 text-sm font-semibold text-brand-blue-fg outline-none hover:underline focus-visible:underline"
          >
            {showPassword ? "Sembunyi" : "Lihat"}
          </button>
        </div>
        {passwordError && <p className="text-xs text-brand-red">{passwordError}</p>}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input id="remember" type="checkbox" className="size-4 rounded border-input accent-[#1e56c9]" />
        Ingat email saya
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-[52px] w-full rounded-xl bg-gradient-to-r from-[#1e6fd9] to-[#1745a8] text-base font-semibold text-white shadow-[0_12px_28px_-10px_rgb(30_111_217/0.65)] outline-none transition-[filter,opacity] hover:brightness-110 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-70"
      >
        {pending ? "Memproses..." : "Masuk"}
      </button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { supplierSchema, TERMS_OPTIONS, type SupplierInput } from "@/lib/validation/purchasing";
import { cn } from "@/lib/utils";
import { saveSupplierAction, setSupplierActiveAction } from "../actions";
import { SelectField } from "./ui";

export function SupplierForm({ id, defaults, readOnly, isActive }: { id: string | null; defaults: SupplierInput; readOnly: boolean; isActive: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState, reset } = useForm<SupplierInput>({ resolver: zodResolver(supplierSchema), defaultValues: defaults });
  const errors = formState.errors;
  const terms = String(defaults.payment_terms_days ?? "0");
  const termOptions = TERMS_OPTIONS.some((t) => t.value === terms) ? TERMS_OPTIONS : [...TERMS_OPTIONS, { value: terms, label: `${terms} hari` }];

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveSupplierAction(id, values);
      if (!result.ok) return setMessage({ ok: false, text: result.error });
      if (!id) return router.push(`/pembelian/supplier/${result.data.id}`);
      reset(values);
      setMessage({ ok: true, text: "Supplier tersimpan." });
      router.refresh();
    });
  });

  const toggle = () =>
    startTransition(async () => {
      if (!id) return;
      const r = await setSupplierActiveAction(id, !isActive);
      setMessage(r.ok ? { ok: true, text: isActive ? "Supplier dinonaktifkan." : "Supplier diaktifkan." } : { ok: false, text: r.error });
      router.refresh();
    });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset disabled={readOnly || pending} className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
        <div className="sm:col-span-2">
          <FormField id="name" label="Nama supplier *" placeholder="mis. PT Sumber Part" error={errors.name?.message} {...register("name")} />
        </div>
        <FormField id="contact_name" label="Nama kontak" {...register("contact_name")} />
        <FormField id="phone" label="Nomor HP / WhatsApp" type="tel" inputMode="tel" {...register("phone")} />
        <FormField id="email" label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <SelectField id="payment_terms_days" label="Termin pembayaran default" {...register("payment_terms_days")}>
          {termOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="address" className="text-sm font-medium">
            Alamat
          </label>
          <textarea id="address" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("address")} />
        </div>
        <FormField id="npwp" label="NPWP (opsional)" {...register("npwp")} />
        <FormField id="bank_name" label="Bank" placeholder="mis. BCA" {...register("bank_name")} />
        <FormField id="bank_account_number" label="Nomor rekening" inputMode="numeric" {...register("bank_account_number")} />
        <FormField id="bank_account_name" label="Atas nama" {...register("bank_account_name")} />
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Catatan
          </label>
          <textarea id="notes" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
        </div>
      </fieldset>
      {message && (message.ok ? <p className="text-sm text-brand-blue-fg">{message.text}</p> : <FormError message={message.text} />)}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Simpan supplier"}
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/pembelian/supplier" />}>
            Kembali
          </Button>
          {id && (
            <Button type="button" variant="outline" disabled={pending} onClick={toggle} className="sm:ml-auto">
              {isActive ? "Nonaktifkan supplier" : "Aktifkan supplier"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { CancelButton } from "@/components/cancel-button";
import { FormError, FormField } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import type { Customer } from "@/lib/customers";
import {
  CUSTOMER_TYPE_LABEL,
  FUEL_LABEL,
  TRANSMISSION_LABEL,
  customerSchema,
  formatPlate,
  transferSchema,
  vehicleSchema,
  type CustomerInput,
  type TransferInput,
  type VehicleInput,
} from "@/lib/validation/customer";
import { cn } from "@/lib/utils";
import { saveCustomerAction, saveVehicleAction, setCustomerActiveAction, setVehicleActiveAction, transferVehicleAction } from "../actions";

type Message = { ok: boolean; text: string } | null;
const Feedback = ({ m }: { m: Message }) => (m ? m.ok ? <p className="text-sm text-brand-blue-fg">{m.text}</p> : <FormError message={m.text} /> : null);

function Select({ id, label, error, children, ...props }: React.ComponentProps<"select"> & { label: string; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} aria-invalid={Boolean(error)} className={inputClass} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const emptyCustomer: CustomerInput = {
  type: "individual",
  name: "",
  phone: "",
  email: "",
  address: "",
  npwp: "",
  credit_limit: "",
  payment_terms_days: "0",
  notes: "",
};

export function CustomerForm({
  id,
  defaults,
  readOnly,
  isActive = true,
  onDone,
  onCancel,
}: {
  id: string | null;
  defaults: CustomerInput;
  readOnly: boolean;
  isActive?: boolean;
  onDone?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState, reset } = useForm<CustomerInput>({ resolver: zodResolver(customerSchema), defaultValues: defaults });
  const type = useWatch({ control, name: "type" });
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const r = await saveCustomerAction(id, values);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      if (!id) return onDone ? onDone(r.data.id) : router.push(`/pelanggan/${r.data.id}`);
      reset(values);
      setMessage({ ok: true, text: "Data pelanggan tersimpan." });
      router.refresh();
    });
  });

  const toggle = () =>
    startTransition(async () => {
      if (!id) return;
      const r = await setCustomerActiveAction(id, !isActive);
      setMessage(r.ok ? { ok: true, text: isActive ? "Pelanggan dinonaktifkan." : "Pelanggan diaktifkan." } : { ok: false, text: r.error });
      router.refresh();
    });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset disabled={readOnly || pending} className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
        <Select id="type" label="Tipe pelanggan" {...register("type")}>
          {(["individual", "company"] as const).map((t) => (
            <option key={t} value={t}>
              {CUSTOMER_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <FormField id="name" label={type === "company" ? "Nama perusahaan *" : "Nama pelanggan *"} error={errors.name?.message} {...register("name")} />
        <FormField id="phone" label="Nomor WhatsApp" type="tel" inputMode="tel" placeholder="0812xxxxxxx" error={errors.phone?.message} {...register("phone")} />
        <FormField id="email" label="Email" type="email" error={errors.email?.message} {...register("email")} />
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="address" className="text-sm font-medium">
            Alamat
          </label>
          <textarea id="address" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("address")} />
        </div>
        <FormField id="npwp" label="NPWP (untuk faktur pajak)" {...register("npwp")} />
        {type === "company" && (
          <>
            <FormField id="credit_limit" label="Batas kredit (Rp)" inputMode="numeric" error={errors.credit_limit?.message} {...register("credit_limit")} />
            <FormField id="payment_terms_days" label="Termin bayar (hari)" inputMode="numeric" error={errors.payment_terms_days?.message} {...register("payment_terms_days")} />
          </>
        )}
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="notes" className="text-sm font-medium">
            Catatan
          </label>
          <textarea id="notes" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
        </div>
      </fieldset>
      <Feedback m={message} />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Simpan pelanggan"}
          </Button>
          {!id && (
            <CancelButton href="/pelanggan" onCancel={onCancel}>
              Kembali
            </CancelButton>
          )}
          {id && (
            <Button type="button" variant="outline" disabled={pending} onClick={toggle} className="sm:ml-auto">
              {isActive ? "Nonaktifkan pelanggan" : "Aktifkan pelanggan"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

export const emptyVehicle: VehicleInput = {
  plate_no: "",
  make: "",
  model: "",
  variant: "",
  year: "",
  color: "",
  transmission: "",
  fuel: "",
  vin: "",
  engine_no: "",
  last_odometer: "",
  notes: "",
  owner_id: "",
};

export function VehicleForm({
  id,
  defaults,
  customers,
  models,
  fixedOwner,
  readOnly,
  isActive = true,
  onDone,
  onCancel,
}: {
  id: string | null;
  defaults: VehicleInput;
  customers: Pick<Customer, "id" | "name" | "phone" | "is_active">[];
  models: { make: string; model: string }[];
  fixedOwner?: { id: string; name: string };
  readOnly: boolean;
  isActive?: boolean;
  onDone?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, formState, reset, setValue } = useForm<VehicleInput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { ...defaults, owner_id: fixedOwner?.id ?? defaults.owner_id },
  });
  const make = useWatch({ control, name: "make" });
  const errors = formState.errors;
  const makes = [...new Set(models.map((m) => m.make))];
  const modelOptions = models.filter((m) => !make || m.make.toLowerCase() === String(make).toLowerCase()).map((m) => m.model);

  const onSubmit = handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const r = await saveVehicleAction(id, values);
      if (!r.ok) return setMessage({ ok: false, text: r.error });
      if (!id) return onDone ? onDone(r.data.id) : router.push(`/pelanggan/kendaraan/${r.data.id}`);
      reset(values);
      setMessage({ ok: true, text: "Data kendaraan tersimpan." });
      router.refresh();
    });
  });

  const toggle = () =>
    startTransition(async () => {
      if (!id) return;
      const r = await setVehicleActiveAction(id, !isActive);
      setMessage(r.ok ? { ok: true, text: isActive ? "Kendaraan dinonaktifkan." : "Kendaraan diaktifkan." } : { ok: false, text: r.error });
      router.refresh();
    });

  const plate = register("plate_no");
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <fieldset disabled={readOnly || pending} className={cn(panel, "grid gap-4 sm:grid-cols-2")}>
        <FormField
          id="plate_no"
          label="Nomor polisi *"
          placeholder="B 1234 KJT"
          className="font-mono uppercase"
          error={errors.plate_no?.message}
          {...plate}
          onBlur={(e) => {
            setValue("plate_no", formatPlate(e.target.value));
            return plate.onBlur(e);
          }}
        />
        {!id &&
          (fixedOwner ? (
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Pemilik</span>
              <p className="flex h-10 items-center rounded-sm bg-muted px-3 text-sm">{fixedOwner.name}</p>
            </div>
          ) : (
            <Select id="owner_id" label="Pemilik *" error={errors.owner_id?.message} {...register("owner_id")}>
              <option value="">Pilih pelanggan</option>
              {customers
                .filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
            </Select>
          ))}
        <div className="grid gap-1.5">
          <FormField id="make" label="Merek" placeholder="mis. Toyota" list={`${listId}-make`} autoComplete="off" {...register("make")} />
          <datalist id={`${listId}-make`}>
            {makes.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-1.5">
          <FormField id="model" label="Model" placeholder="mis. Avanza" list={`${listId}-model`} autoComplete="off" {...register("model")} />
          <datalist id={`${listId}-model`}>
            {modelOptions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <FormField id="variant" label="Varian" placeholder="mis. 1.3 G" {...register("variant")} />
        <FormField id="year" label="Tahun" inputMode="numeric" error={errors.year?.message} {...register("year")} />
        <FormField id="color" label="Warna" {...register("color")} />
        <Select id="transmission" label="Transmisi" {...register("transmission")}>
          <option value="">Belum diisi</option>
          {(Object.keys(TRANSMISSION_LABEL) as (keyof typeof TRANSMISSION_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {TRANSMISSION_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select id="fuel" label="Bahan bakar" {...register("fuel")}>
          <option value="">Belum diisi</option>
          {(Object.keys(FUEL_LABEL) as (keyof typeof FUEL_LABEL)[]).map((k) => (
            <option key={k} value={k}>
              {FUEL_LABEL[k]}
            </option>
          ))}
        </Select>
        <FormField id="last_odometer" label="Kilometer terakhir" inputMode="numeric" error={errors.last_odometer?.message} {...register("last_odometer")} />
        <FormField id="vin" label="Nomor rangka (opsional)" className="font-mono uppercase" {...register("vin")} />
        <FormField id="engine_no" label="Nomor mesin (opsional)" className="font-mono uppercase" {...register("engine_no")} />
        <div className="grid gap-1.5 sm:col-span-2">
          <label htmlFor="v_notes" className="text-sm font-medium">
            Catatan
          </label>
          <textarea id="v_notes" rows={2} className={cn(inputClass, "h-auto py-2")} {...register("notes")} />
        </div>
      </fieldset>
      <Feedback m={message} />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan..." : id ? "Simpan perubahan" : "Simpan kendaraan"}
          </Button>
          {!id && (
            <CancelButton href="/pelanggan/kendaraan" onCancel={onCancel}>
              Kembali
            </CancelButton>
          )}
          {id && (
            <Button type="button" variant="outline" disabled={pending} onClick={toggle} className="sm:ml-auto">
              {isActive ? "Nonaktifkan kendaraan" : "Aktifkan kendaraan"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/** Pindah pemilik kendaraan: riwayat servis tetap ikut kendaraan */
export function TransferForm({
  vehicleId,
  currentOwnerId,
  customers,
  today,
}: {
  vehicleId: string;
  currentOwnerId: string | null;
  customers: Pick<Customer, "id" | "name" | "phone" | "is_active">[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState, reset } = useForm<TransferInput>({
    resolver: zodResolver(transferSchema),
    defaultValues: { customer_id: "", date: today, note: "" },
  });

  if (!open)
    return (
      <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        Pindah pemilik
      </Button>
    );

  return (
    <form
      noValidate
      className="grid gap-3 rounded-sm border border-border p-3"
      onSubmit={handleSubmit((v) =>
        startTransition(async () => {
          setMessage(null);
          const r = await transferVehicleAction(vehicleId, v);
          if (!r.ok) return setMessage({ ok: false, text: r.error });
          reset();
          setOpen(false);
          router.refresh();
        }),
      )}
    >
      <Select id="new_owner" label="Pemilik baru" error={formState.errors.customer_id?.message} {...register("customer_id")}>
        <option value="">Pilih pelanggan</option>
        {customers
          .filter((c) => c.is_active && c.id !== currentOwnerId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.phone ? ` · ${c.phone}` : ""}
            </option>
          ))}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="transfer_date" label="Tanggal pindah" type="date" error={formState.errors.date?.message} {...register("date")} />
        <FormField id="transfer_note" label="Catatan" placeholder="mis. Dijual" {...register("note")} />
      </div>
      <Feedback m={message} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan pemilik baru"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}

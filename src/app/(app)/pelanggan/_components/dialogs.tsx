"use client";

import { Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog, useCreateDialog } from "@/components/form-dialog";
import type { Customer } from "@/lib/customers";
import { CustomerForm, VehicleForm, emptyCustomer, emptyVehicle } from "./forms";

export function NewCustomerDialog() {
  const d = useCreateDialog({ message: "Pelanggan ditambahkan.", detailHref: (id) => `/pelanggan/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah pelanggan
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah pelanggan" description="Kendaraan bisa ditambahkan setelahnya dari profil pelanggan." size="lg">
        <CustomerForm id={null} defaults={emptyCustomer} readOnly={false} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

export function NewVehicleDialog({
  customers,
  models,
  fixedOwner,
  variant = "default",
}: {
  customers: Pick<Customer, "id" | "name" | "phone" | "is_active">[];
  models: { make: string; model: string }[];
  fixedOwner?: { id: string; name: string };
  variant?: "default" | "outline";
}) {
  const d = useCreateDialog({ message: "Kendaraan ditambahkan.", detailHref: (id) => `/pelanggan/kendaraan/${id}` });
  return (
    <>
      <Button variant={variant} onClick={() => d.setOpen(true)}>
        <Car className="size-4" /> Tambah kendaraan
      </Button>
      <FormDialog
        open={d.open}
        onOpenChange={d.setOpen}
        title={fixedOwner ? `Tambah kendaraan ${fixedOwner.name}` : "Tambah kendaraan"}
        description="Merek & model yang belum ada otomatis ditambahkan ke master."
        size="lg"
      >
        <VehicleForm
          id={null}
          defaults={emptyVehicle}
          customers={customers}
          models={models}
          fixedOwner={fixedOwner}
          readOnly={false}
          onDone={d.onDone}
          onCancel={d.onCancel}
        />
      </FormDialog>
    </>
  );
}

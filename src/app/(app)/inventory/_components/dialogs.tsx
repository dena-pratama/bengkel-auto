"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog, useCreateDialog } from "@/components/form-dialog";
import type { ServiceCategory } from "@/lib/inventory";
import { ItemForm, type ItemLookups } from "./item-form";
import { PackageForm, type ComponentOption } from "./package-form";
import { ServiceForm } from "./service-form";

export function NewItemDialog({ lookups, canSetPrice }: { lookups: ItemLookups; canSetPrice: boolean }) {
  const d = useCreateDialog({ message: "Barang ditambahkan.", detailHref: (id) => `/inventory/barang/${id}` });
  const pcs = lookups.units.find((u) => u.code === "pcs");
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah barang
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah barang" description="Saldo awal stok diisi dari halaman detail barang." size="xl">
        <ItemForm
          id={null}
          lookups={lookups}
          baseUnitLocked={false}
          canSetPrice={canSetPrice}
          readOnly={false}
          isActive
          onDone={d.onDone}
          onCancel={d.onCancel}
          defaults={{
            sku: "",
            name: "",
            category_id: "",
            brand_id: "",
            base_unit_id: pcs?.id ?? "",
            sell_price: "",
            min_stock: "",
            default_location_id: "",
            warranty_days: "",
            is_taxable: true,
            notes: "",
            units: [],
            part_numbers: [],
          }}
        />
      </FormDialog>
    </>
  );
}

export function NewServiceDialog({ categories, canSetPrice }: { categories: ServiceCategory[]; canSetPrice: boolean }) {
  const d = useCreateDialog({ message: "Jasa ditambahkan.", detailHref: (id) => `/inventory/jasa/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah jasa
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah jasa" size="md">
        <ServiceForm
          id={null}
          categories={categories}
          canSetPrice={canSetPrice}
          readOnly={false}
          isActive
          onDone={d.onDone}
          onCancel={d.onCancel}
          defaults={{
            code: "",
            name: "",
            category_id: "",
            price: "",
            duration_minutes: "60",
            commission_type: "percent",
            commission_value: "",
            warranty_days: "",
            is_taxable: true,
          }}
        />
      </FormDialog>
    </>
  );
}

export function NewPackageDialog({ options, canSetPrice }: { options: ComponentOption[]; canSetPrice: boolean }) {
  const d = useCreateDialog({ message: "Paket servis ditambahkan.", detailHref: (id) => `/inventory/paket/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah paket
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah paket servis" description="Gabungan jasa & barang dengan satu harga jual." size="xl">
        <PackageForm
          id={null}
          options={options}
          allocation={[]}
          canSetPrice={canSetPrice}
          readOnly={false}
          isActive
          onDone={d.onDone}
          onCancel={d.onCancel}
          defaults={{ code: "", name: "", description: "", price: "", items: [] }}
        />
      </FormDialog>
    </>
  );
}

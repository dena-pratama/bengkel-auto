"use client";

import { PackageCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialog, useCreateDialog } from "@/components/form-dialog";
import type { ItemOption, Supplier } from "@/lib/purchasing";
import type { ReceiptFormData } from "../receipt-data";
import { PoForm } from "./po-form";
import { ReceiptForm } from "./receipt-form";
import { SupplierForm } from "./supplier-form";

export function NewSupplierDialog() {
  const d = useCreateDialog({ message: "Supplier ditambahkan.", detailHref: (id) => `/pembelian/supplier/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Tambah supplier
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Tambah supplier" size="lg">
        <SupplierForm
          id={null}
          readOnly={false}
          isActive
          onDone={d.onDone}
          onCancel={d.onCancel}
          defaults={{
            name: "",
            contact_name: "",
            phone: "",
            email: "",
            address: "",
            npwp: "",
            payment_terms_days: "0",
            bank_name: "",
            bank_account_number: "",
            bank_account_name: "",
            notes: "",
          }}
        />
      </FormDialog>
    </>
  );
}

export function NewPoDialog({ suppliers, items, today }: { suppliers: Supplier[]; items: ItemOption[]; today: string }) {
  const d = useCreateDialog({ message: "PO disimpan sebagai draft.", detailHref: (id) => `/pembelian/po/${id}` });
  return (
    <>
      <Button onClick={() => d.setOpen(true)}>
        <Plus className="size-4" /> Buat PO
      </Button>
      <FormDialog open={d.open} onOpenChange={d.setOpen} title="Buat purchase order" size="xl">
        <PoForm
          id={null}
          suppliers={suppliers}
          items={items}
          onDone={d.onDone}
          onCancel={d.onCancel}
          defaults={{ supplier_id: "", order_date: today, expected_date: "", notes: "", items: [] }}
        />
      </FormDialog>
    </>
  );
}

/** Terima barang (dari PO bila data.poLabel terisi, atau langsung tanpa PO) */
export function NewReceiptDialog({
  data,
  canPay,
  label,
  variant = "default",
}: {
  data: ReceiptFormData;
  canPay: boolean;
  label: string;
  variant?: "default" | "outline";
}) {
  const d = useCreateDialog({ message: "Penerimaan tersimpan: stok, HPP, dan hutang sudah diperbarui.", detailHref: (id) => `/pembelian/penerimaan/${id}` });
  return (
    <>
      <Button variant={variant} onClick={() => d.setOpen(true)}>
        <PackageCheck className="size-4" /> {label}
      </Button>
      <FormDialog
        open={d.open}
        onOpenChange={d.setOpen}
        title={data.poLabel ? `Terima barang dari ${data.poLabel}` : "Terima barang"}
        description="Stok bertambah, HPP dihitung ulang, hutang & jurnal tercatat otomatis."
        size="xl"
      >
        <ReceiptForm {...data} canPay={canPay} onDone={d.onDone} onCancel={d.onCancel} />
      </FormDialog>
    </>
  );
}

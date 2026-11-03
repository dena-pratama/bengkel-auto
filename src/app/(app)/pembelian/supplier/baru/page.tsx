import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { SupplierForm } from "../../_components/supplier-form";

export default function NewSupplierPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <PageHeader title="Tambah supplier" back={{ href: "/pembelian/supplier", label: "Supplier" }} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "purchasing", "create", false)) return <NoAccess />;
  return (
    <SupplierForm
      id={null}
      readOnly={false}
      isActive
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
  );
}

import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listServiceCategories } from "@/lib/inventory";
import { ServiceForm } from "../../_components/service-form";

export default function NewServicePage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <PageHeader title="Tambah jasa" back={{ href: "/inventory/jasa", label: "Jasa" }} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "create", false)) return <NoAccess />;
  return (
    <ServiceForm
      id={null}
      categories={await listServiceCategories()}
      canSetPrice={can(ctx, "price_change", "create", false)}
      readOnly={false}
      isActive
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
  );
}

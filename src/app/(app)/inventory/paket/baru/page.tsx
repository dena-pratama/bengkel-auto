import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { PackageForm } from "../../_components/package-form";
import { componentOptions } from "../options";

export default function NewPackagePage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <PageHeader title="Tambah paket servis" back={{ href: "/inventory/paket", label: "Paket servis" }} />
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
    <PackageForm
      id={null}
      options={await componentOptions()}
      allocation={[]}
      canSetPrice={can(ctx, "price_change", "create", false)}
      readOnly={false}
      isActive
      defaults={{ code: "", name: "", description: "", price: "", items: [] }}
    />
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getPackage } from "@/lib/inventory";
import { PackageForm } from "../../_components/package-form";
import { componentOptions } from "../options";

export default function PackageDetailPage({ params }: PageProps<"/inventory/paket/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const pkg = await getPackage(id);
  if (!pkg) notFound();
  const items = pkg.components.map((c) =>
    c.item_id ? { kind: "item" as const, id: c.item_id, qty: String(c.qty) } : { kind: "service" as const, id: c.service_id!, qty: String(c.qty) },
  );

  return (
    <>
      <PageHeader title={pkg.name} description={`${pkg.code}${pkg.is_active ? "" : " · Nonaktif"}`} back={{ href: "/inventory/paket", label: "Paket servis" }} />
      <PackageForm
        key={pkg.id}
        id={pkg.id}
        options={await componentOptions(items)}
        allocation={pkg.components}
        canSetPrice={can(ctx, "price_change", "create", false)}
        readOnly={!can(ctx, "master_data", "update", false)}
        isActive={pkg.is_active}
        defaults={{ code: pkg.code, name: pkg.name, description: pkg.description ?? "", price: String(pkg.price), items }}
      />
    </>
  );
}

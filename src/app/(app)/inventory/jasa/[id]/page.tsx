import { Suspense } from "react";
import { notFound } from "next/navigation";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listServiceCategories, listServices } from "@/lib/inventory";
import { ServiceForm } from "../../_components/service-form";

export default function ServiceDetailPage({ params }: PageProps<"/inventory/jasa/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
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
  const [services, categories] = await Promise.all([listServices(), listServiceCategories()]);
  const s = services.find((x) => x.id === id);
  if (!s) notFound();

  return (
    <>
      <PageHeader title={s.name} description={`${s.code}${s.is_active ? "" : " · Nonaktif"}`} back={{ href: "/inventory/jasa", label: "Jasa" }} />
      <ServiceForm
        key={s.id}
        id={s.id}
        categories={categories}
        canSetPrice={can(ctx, "price_change", "create", false)}
        readOnly={!can(ctx, "master_data", "update", false)}
        isActive={s.is_active}
        defaults={{
          code: s.code,
          name: s.name,
          category_id: s.category_id ?? "",
          price: String(s.price),
          duration_minutes: String(s.duration_minutes),
          commission_type: s.commission_type,
          commission_value: String(s.commission_value),
          warranty_days: String(s.warranty_days),
          is_taxable: s.is_taxable,
        }}
      />
    </>
  );
}

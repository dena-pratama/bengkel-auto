import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { todayWib } from "@/lib/format";
import { listItemOptions, listSuppliers } from "@/lib/purchasing";
import { PoForm } from "../../_components/po-form";

export default function NewPoPage() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <PageHeader title="Buat purchase order" back={{ href: "/pembelian", label: "Purchase order" }} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "purchasing", "create", false)) return <NoAccess />;
  const [suppliers, items] = await Promise.all([listSuppliers(), listItemOptions()]);
  return (
    <PoForm
      id={null}
      suppliers={suppliers}
      items={items}
      defaults={{ supplier_id: "", order_date: todayWib(), expected_date: "", notes: "", items: [] }}
    />
  );
}

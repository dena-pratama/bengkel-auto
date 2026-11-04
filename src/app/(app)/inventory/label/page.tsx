import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listItems, listLocations } from "@/lib/inventory";
import { InventoryNav } from "../_components/nav";
import { LabelPrinter } from "./_label-printer";

export default function LabelPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <div className="print:hidden">
        <InventoryNav active="labels" />
      </div>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const [items, locations] = await Promise.all([listItems(), listLocations()]);
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Label QR" description="Cetak label barang dan rak untuk printer thermal 30 x 20 mm, 50 x 30 mm, atau lembar A4." />
      </div>
      <LabelPrinter
        items={items.filter((i) => i.is_active).map((i) => ({ id: i.id, code: i.sku, name: i.name }))}
        locations={locations.filter((l) => l.is_active).map((l) => ({ id: l.id, code: l.code, name: l.path }))}
      />
    </>
  );
}

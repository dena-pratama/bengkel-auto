import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listItems } from "@/lib/inventory";
import { InventoryNav } from "./_components/nav";
import { ItemsTable } from "./_components/items-table";

export default function ItemsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <InventoryNav active="items" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const items = await listItems();
  const low = items.filter((i) => i.is_active && i.min_stock > 0 && i.qty <= i.min_stock).length;

  return (
    <>
      <PageHeader
        title="Barang"
        description={`${items.filter((i) => i.is_active).length} barang aktif${low ? ` · ${low} stok menipis` : ""}`}
        actions={
          can(ctx, "master_data", "create", false) && (
            <Button nativeButton={false} render={<Link href="/inventory/barang/baru" />}>
              <Plus className="size-4" /> Tambah barang
            </Button>
          )
        }
      />
      <ItemsTable items={items} />
    </>
  );
}

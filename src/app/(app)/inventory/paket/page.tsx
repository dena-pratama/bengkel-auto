import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { listPackages } from "@/lib/inventory";
import { InventoryNav } from "../_components/nav";
import { SimpleList } from "../_components/simple-list";

export default function PackagesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <InventoryNav active="packages" />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const packages = await listPackages();

  return (
    <>
      <PageHeader
        title="Paket servis"
        description="Gabungan jasa & barang dengan satu harga jual."
        actions={
          can(ctx, "master_data", "create", false) && (
            <Button nativeButton={false} render={<Link href="/inventory/paket/baru" />}>
              <Plus className="size-4" /> Tambah paket
            </Button>
          )
        }
      />
      <SimpleList
        icon="packages"
        searchLabel="Cari nama atau kode paket…"
        empty="Belum ada paket. Contoh: Paket Ganti Oli = oli 4 liter + filter + jasa."
        rows={packages.map((p) => ({
          id: p.id,
          href: `/inventory/paket/${p.id}`,
          title: p.name,
          code: p.code,
          meta: [`${p.component_count} komponen`],
          value: formatRupiah(p.price),
          is_active: p.is_active,
        }))}
      />
    </>
  );
}

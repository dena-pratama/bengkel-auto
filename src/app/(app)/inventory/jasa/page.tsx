import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { listServiceCategories, listServices } from "@/lib/inventory";
import { InventoryNav } from "../_components/nav";
import { SimpleList } from "../_components/simple-list";

export default function ServicesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <InventoryNav active="services" />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "master_data", "view")) return <NoAccess />;
  const [services, categories] = await Promise.all([listServices(), listServiceCategories()]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <PageHeader
        title="Jasa"
        description={`${services.filter((s) => s.is_active).length} jasa aktif`}
        actions={
          can(ctx, "master_data", "create", false) && (
            <Button nativeButton={false} render={<Link href="/inventory/jasa/baru" />}>
              <Plus className="size-4" /> Tambah jasa
            </Button>
          )
        }
      />
      <SimpleList
        icon="services"
        searchLabel="Cari nama atau kode jasa…"
        empty="Belum ada jasa. Tambahkan jasa pertama."
        rows={services.map((s) => ({
          id: s.id,
          href: `/inventory/jasa/${s.id}`,
          title: s.name,
          code: s.code,
          meta: [s.category_id ? (catName.get(s.category_id) ?? "") : "", `${s.duration_minutes} menit`],
          value: formatRupiah(s.price),
          is_active: s.is_active,
        }))}
      />
    </>
  );
}

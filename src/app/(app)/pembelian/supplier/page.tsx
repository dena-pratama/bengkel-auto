import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatRupiah } from "@/lib/format";
import { listApReceipts, listSuppliers } from "@/lib/purchasing";
import { cn } from "@/lib/utils";
import { NewSupplierDialog } from "../_components/dialogs";
import { PurchasingNav } from "../_components/ui";

export default function SuppliersPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  const canPayables = can(ctx, "payables", "view", false);
  if (!can(ctx, "purchasing", "view", false) && !canPayables) return <NoAccess />;
  const [suppliers, ap] = await Promise.all([listSuppliers(), canPayables ? listApReceipts() : Promise.resolve([])]);
  const debt = new Map<string, number>();
  for (const r of ap) debt.set(r.supplier_id, (debt.get(r.supplier_id) ?? 0) + r.outstanding);

  return (
    <>
      <PurchasingNav active="suppliers" showPayables={canPayables} />
      <PageHeader
        title="Supplier"
        description={`${suppliers.filter((s) => s.is_active).length} supplier aktif`}
        actions={
          can(ctx, "purchasing", "create", false) && <NewSupplierDialog />
        }
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {suppliers.length === 0 ? (
          <EmptyState icon={Truck} text="Belum ada supplier." />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/pembelian/supplier/${s.id}`}
                  className={cn("flex h-full items-center gap-3 rounded-sm border border-border p-3 hover:bg-muted/60", !s.is_active && "opacity-60")}
                >
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{s.code}</span> · {s.payment_terms_days === 0 ? "Tunai" : `Termin ${s.payment_terms_days} hari`}
                      {s.phone && ` · ${s.phone}`}
                    </p>
                  </div>
                  {canPayables && (debt.get(s.id) ?? 0) > 0 && (
                    <span className="shrink-0 text-right">
                      <span className="block text-2xs text-muted-foreground">Hutang</span>
                      <span className="text-sm font-semibold text-brand-red tabular-nums">{formatRupiah(debt.get(s.id))}</span>
                    </span>
                  )}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

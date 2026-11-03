import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listSales } from "@/lib/cashier";
import { CashierNav } from "../_components/ui";
import { SalesList } from "../_components/sales-list";

export default function SalesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="sales" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "sales", "view", false) && !can(ctx, "receivables", "view", false)) return <NoAccess />;
  const sales = await listSales();
  return (
    <>
      <PageHeader title="Penjualan & invoice" description={`${sales.filter((s) => s.status === "posted").length} transaksi diposting`} />
      <SalesList sales={sales} />
    </>
  );
}

import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { listSaleReturns } from "@/lib/cashier";
import { CashierNav } from "../_components/ui";
import { ReturnsList } from "../_components/returns-list";

export default function SaleReturnsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="returns" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "sales", "view", false) && !can(ctx, "receivables", "view", false)) return <NoAccess />;
  const returns = await listSaleReturns();
  return (
    <>
      <PageHeader
        title="Retur penjualan"
        description={`${returns.length} transaksi retur tercatat`}
      />
      <ReturnsList returns={returns} />
    </>
  );
}

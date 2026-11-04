import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { listSaleReturns } from "@/lib/cashier";
import { formatDate, todayWib } from "@/lib/format";
import { readOption, readRange, describeRange } from "@/lib/list-filter";
import { RETURN_STATUS_FILTERS, RETURN_STATUS_FILTER_LABEL, SETTLEMENTS, SETTLEMENT_LABEL } from "@/lib/validation/cashier";
import { CashierNav } from "../_components/ui";
import { ReturnsList } from "../_components/returns-list";

export default function SaleReturnsPage({ searchParams }: PageProps<"/kasir/retur">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="returns" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "sales", "view", false) && !can(ctx, "receivables", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "bulan-ini");
  const settlement = readOption(sp, "bentuk", SETTLEMENTS);
  const status = readOption(sp, "status", RETURN_STATUS_FILTERS);
  const returns = await listSaleReturns({ from: range.from, to: range.to, settlement, status });
  return (
    <>
      <PageHeader title="Retur penjualan" description={`${describeRange(range, formatDate)} · ${returns.length} transaksi retur`} />
      <ListFilter
        today={today}
        range={range}
        defaultRange="bulan-ini"
        selects={[
          { name: "bentuk", label: "Bentuk retur", value: settlement, options: SETTLEMENTS.map((v) => ({ value: v, label: SETTLEMENT_LABEL[v] })), allLabel: "Semua bentuk" },
          { name: "status", label: "Status", value: status, options: RETURN_STATUS_FILTERS.map((v) => ({ value: v, label: RETURN_STATUS_FILTER_LABEL[v] })), allLabel: "Semua status" },
        ]}
      />
      <ReturnsList returns={returns} />
    </>
  );
}

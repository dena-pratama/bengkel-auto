import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ListFilter } from "@/components/list-filter";
import { searchSales } from "@/lib/cashier";
import { formatDate, todayWib } from "@/lib/format";
import { readOption, readRange, describeRange } from "@/lib/list-filter";
import { SALE_SOURCE_FILTERS, SALE_SOURCE_FILTER_LABEL, SALE_STATUS_FILTERS, SALE_STATUS_FILTER_LABEL } from "@/lib/validation/cashier";
import { CashierNav } from "../_components/ui";
import { SalesList } from "../_components/sales-list";

export default function SalesPage({ searchParams }: PageProps<"/kasir/penjualan">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <CashierNav active="sales" />
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
  const status = readOption(sp, "status", SALE_STATUS_FILTERS);
  const source = readOption(sp, "jenis", SALE_SOURCE_FILTERS);
  const { rows: sales, capped } = await searchSales({ from: range.from, to: range.to, status, source });
  return (
    <>
      <PageHeader title="Penjualan & invoice" description={`${describeRange(range, formatDate)} · ${sales.length} transaksi${capped ? " (500 terbaru, persempit filter)" : ""}`} />
      <ListFilter
        today={today}
        range={range}
        defaultRange="bulan-ini"
        selects={[
          { name: "status", label: "Status", value: status, options: SALE_STATUS_FILTERS.map((v) => ({ value: v, label: SALE_STATUS_FILTER_LABEL[v] })), allLabel: "Semua status" },
          { name: "jenis", label: "Jenis", value: source, options: SALE_SOURCE_FILTERS.map((v) => ({ value: v, label: SALE_SOURCE_FILTER_LABEL[v] })), allLabel: "Semua jenis" },
        ]}
      />
      <SalesList sales={sales} />
    </>
  );
}

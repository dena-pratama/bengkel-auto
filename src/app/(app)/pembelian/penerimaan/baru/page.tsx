import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { ReceiptForm } from "../../_components/receipt-form";
import { UUID } from "../../_components/ui";
import { receiptFormData } from "../../receipt-data";

export default function NewReceiptPage({ searchParams }: PageProps<"/pembelian/penerimaan/baru">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <PageHeader title="Terima barang" back={{ href: "/pembelian/penerimaan", label: "Penerimaan barang" }} />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "purchasing", "create", false)) return <NoAccess />;
  const poParam = (await searchParams).po;
  const poId = typeof poParam === "string" && UUID.test(poParam) ? poParam : null;

  const data = await receiptFormData(poId);
  return <ReceiptForm {...data} canPay={can(ctx, "payables", "create", false)} />;
}

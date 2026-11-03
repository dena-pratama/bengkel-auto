import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { todayWib } from "@/lib/format";
import { listLocations } from "@/lib/inventory";
import { getPurchaseOrder, listCashBankAccounts, listItemOptions, listSuppliers, ppnEnabled } from "@/lib/purchasing";
import { ReceiptForm } from "../../_components/receipt-form";
import { UUID } from "../../_components/ui";

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

  const [suppliers, items, locations, cashAccounts, ppn, po] = await Promise.all([
    listSuppliers(),
    listItemOptions(),
    listLocations(),
    listCashBankAccounts(),
    ppnEnabled(),
    poId ? getPurchaseOrder(poId) : Promise.resolve(null),
  ]);
  const itemDefaults = new Map(items.map((i) => [i.id, i.default_location_id]));
  const firstBin = locations.find((l) => l.is_active)?.id ?? "";

  // Dari PO: isi sisa yang belum diterima (dalam satuan PO)
  const poLines =
    po && (po.status === "sent" || po.status === "partial")
      ? po.items
          .map((i) => ({ ...i, remaining: i.qty - i.received_base_qty / i.factor }))
          .filter((i) => i.remaining > 0)
          .map((i) => ({
            item_id: i.item_id,
            unit_id: i.unit_id,
            qty: String(Math.round(i.remaining * 1000) / 1000),
            unit_price: String(i.unit_price),
            discount_amount: "",
            location_id: itemDefaults.get(i.item_id) ?? firstBin,
            po_item_id: i.id,
          }))
      : [];

  return (
    <ReceiptForm
      suppliers={suppliers}
      items={items}
      locations={locations}
      cashAccounts={cashAccounts}
      ppnEnabled={ppn}
      canPay={can(ctx, "payables", "create", false)}
      poLabel={po && poLines.length > 0 ? `${po.po_no} · ${po.supplier}` : null}
      defaults={{
        supplier_id: po?.supplier_id ?? "",
        po_id: po && poLines.length > 0 ? po.id : "",
        receipt_date: todayWib(),
        invoice_no: "",
        invoice_date: "",
        due_date: "",
        ppn_amount: "",
        notes: "",
        pay_now: false,
        paid_amount: "",
        cash_bank_account_id: "",
        items: poLines,
      }}
    />
  );
}

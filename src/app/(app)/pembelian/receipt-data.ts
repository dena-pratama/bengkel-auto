import "server-only";
import { todayWib } from "@/lib/format";
import { listLocations } from "@/lib/inventory";
import { getPurchaseOrder, listCashBankAccounts, listItemOptions, listSuppliers, ppnEnabled } from "@/lib/purchasing";
import type { ReceiptInput } from "@/lib/validation/purchasing";

/** Data form penerimaan barang; jika poId diberikan, baris diisi sisa PO yang belum diterima. */
export async function receiptFormData(poId: string | null) {
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
  const fromPo = po && poLines.length > 0;

  const defaults: ReceiptInput = {
    supplier_id: po?.supplier_id ?? "",
    po_id: fromPo ? po.id : "",
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
  };
  return { suppliers, items, locations, cashAccounts, ppnEnabled: ppn, poLabel: fromPo ? `${po.po_no} · ${po.supplier}` : null, defaults };
}

export type ReceiptFormData = Awaited<ReturnType<typeof receiptFormData>>;

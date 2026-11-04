import { can, getUserContext } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { pdfResponse, renderPdf } from "@/lib/pdf";
import { getPurchaseOrder } from "@/lib/purchasing";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS: Record<string, string> = { draft: "Draft", sent: "Terkirim", partial: "Sebagian diterima", received: "Selesai", cancelled: "Dibatalkan" };

/** Purchase order sebagai PDF (untuk dikirim ke supplier). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (!can(ctx, "purchasing", "view", false)) return Response.json({ error: "Anda tidak punya izin." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "PO tidak ditemukan." }, { status: 404 });
  const po = await getPurchaseOrder(id);
  if (!po) return Response.json({ error: "PO tidak ditemukan." }, { status: 404 });

  const total = po.items.reduce((t, i) => t + i.qty * i.unit_price, 0);
  const bytes = await renderPdf({
    shop: ctx.branch.name,
    title: `Purchase Order ${po.po_no}`,
    meta: [
      ["Supplier", po.supplier],
      ["Tanggal", formatDate(po.order_date)],
      ["Status", STATUS[po.status] ?? po.status],
      ...(po.expected_date ? ([["Perkiraan datang", formatDate(po.expected_date)]] as [string, string][]) : []),
    ],
    tables: [
      {
        title: "Barang dipesan",
        head: ["No", "SKU", "Barang", "Jumlah", "Harga satuan", "Subtotal"],
        rows: po.items.map((i, n) => [String(n + 1), i.sku, i.item_name, `${formatQty(i.qty)} ${i.unit}`, formatRupiah(i.unit_price), formatRupiah(i.qty * i.unit_price)]),
        widths: [0.5, 2, 5, 1.5, 1.8, 1.8],
        align: ["l", "l", "l", "r", "r", "r"],
      },
    ],
    totals: [["Total", formatRupiah(total)]],
    notes: po.notes ? [`Catatan: ${po.notes}`] : [],
  });
  return pdfResponse(bytes, po.po_no);
}

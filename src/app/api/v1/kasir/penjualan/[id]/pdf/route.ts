import { getSale } from "@/lib/cashier";
import { can, getUserContext } from "@/lib/auth";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import { pdfResponse, renderPdf } from "@/lib/pdf";
import { METHOD_LABEL } from "@/lib/validation/cashier";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Invoice A4 sebagai PDF (untuk dikirim atau diarsipkan). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (!can(ctx, "sales", "view", false) && !can(ctx, "receivables", "view", false)) return Response.json({ error: "Anda tidak punya izin." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  const s = await getSale(id);
  if (!s) return Response.json({ error: "Invoice tidak ditemukan." }, { status: 404 });

  const paid = s.payments.filter((p) => p.status === "posted");
  const dpp = s.total - s.ppn_amount;
  const totals: [string, string][] = [["Subtotal", formatRupiah(s.subtotal)]];
  if (s.discount_amount > 0) totals.push(["Diskon", `-${formatRupiah(s.discount_amount)}`]);
  if (s.ppn_amount > 0) {
    totals.push(["DPP", formatRupiah(dpp)]);
    totals.push(["PPN", formatRupiah(s.ppn_amount)]);
  }
  totals.push(["Total", formatRupiah(s.total)]);

  const bytes = await renderPdf({
    shop: ctx.branch.name,
    title: s.sale_no ? `Invoice ${s.sale_no}` : "Draft penjualan",
    subtitle: s.status === "void" ? `DIBATALKAN: ${s.void_reason ?? ""}` : undefined,
    meta: [
      ["Tanggal", formatDate(s.sale_date)],
      ["Pelanggan", s.customer_name ?? "Umum"],
      ...(s.plate_no ? ([["Kendaraan", s.plate_no]] as [string, string][]) : []),
      ...(s.wo_no ? ([["Work order", s.wo_no]] as [string, string][]) : []),
      ...(s.due_date ? ([["Jatuh tempo", formatDate(s.due_date)]] as [string, string][]) : []),
    ],
    tables: [
      {
        title: "Rincian",
        head: ["Uraian", "Jumlah", "Harga", "Diskon", "Subtotal"],
        rows: s.lines.map((l) => [l.description, formatQty(l.qty), formatRupiah(l.unit_price), l.discount_amount > 0 ? formatRupiah(l.discount_amount) : "", formatRupiah(l.line_total)]),
        widths: [5, 1, 1.8, 1.6, 1.8],
        align: ["l", "r", "r", "r", "r"],
      },
      ...(paid.length > 0
        ? [
            {
              title: "Pembayaran",
              head: ["Metode", "Referensi", "Jumlah"],
              rows: paid.map((p) => [(METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] as string | undefined) ?? p.method, p.reference ?? "", formatRupiah(p.amount)]),
              widths: [3, 4, 2],
              align: ["l", "l", "r"] as ("l" | "r")[],
            },
          ]
        : []),
    ],
    totals: [...totals, ...(s.status === "posted" ? ([["Dibayar", formatRupiah(s.paid)], [s.outstanding > 0 ? "Sisa tagihan" : "Status", s.outstanding > 0 ? formatRupiah(s.outstanding) : "LUNAS"]] as [string, string][]) : [])],
    notes: s.notes ? [`Catatan: ${s.notes}`] : [],
  });
  return pdfResponse(bytes, s.sale_no ?? "draft-penjualan");
}

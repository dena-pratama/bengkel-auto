import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import type { SaleDetail } from "@/lib/cashier";
import { METHOD_LABEL } from "@/lib/validation/cashier";

/** Nota ringkas untuk printer thermal 58/80 mm. Tersembunyi di layar; tampil hanya saat cetak nota thermal. */
export function ThermalReceipt({ s, shop }: { s: SaleDetail; shop: string }) {
  const paid = s.payments.filter((p) => p.status === "posted");
  const row = (l: string, r: string, bold = false) => (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span>{l}</span>
      <span className="tabular-nums">{r}</span>
    </div>
  );
  return (
    <div className="thermal-only font-mono text-[11px] leading-tight text-black">
      <p className="text-center text-sm font-bold">{shop}</p>
      <p className="text-center">{s.sale_no ?? "Draft penjualan"}</p>
      <p className="text-center">
        {formatDate(s.sale_date)}
        {s.plate_no ? ` · ${s.plate_no}` : ""}
      </p>
      <p className="text-center">{s.customer_name ?? "Umum"}</p>
      <hr className="my-1 border-t border-dashed border-black" />
      {s.lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>{l.description}</p>
          {row(`  ${formatQty(l.qty)} x ${formatRupiah(l.unit_price)}`, formatRupiah(l.line_total))}
          {l.discount_amount > 0 && row("  Diskon", `-${formatRupiah(l.discount_amount)}`)}
        </div>
      ))}
      <hr className="my-1 border-t border-dashed border-black" />
      {row("Subtotal", formatRupiah(s.subtotal))}
      {s.discount_amount > 0 && row("Diskon", `-${formatRupiah(s.discount_amount)}`)}
      {s.ppn_amount > 0 && row("PPN", formatRupiah(s.ppn_amount))}
      {row("TOTAL", formatRupiah(s.total), true)}
      {paid.map((p) => row(`Bayar ${(METHOD_LABEL[p.method as keyof typeof METHOD_LABEL] as string | undefined) ?? p.method}`, formatRupiah(p.amount)))}
      {s.status === "posted" && row(s.outstanding > 0 ? "Sisa tagihan" : "Status", s.outstanding > 0 ? formatRupiah(s.outstanding) : "LUNAS", true)}
      <hr className="my-1 border-t border-dashed border-black" />
      <p className="text-center">Terima kasih</p>
    </div>
  );
}

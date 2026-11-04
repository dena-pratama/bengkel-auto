import { can, getUserContext } from "@/lib/auth";
import { getBalanceSheet, getCashFlow, getMargin, getProfitLoss, summarizeProfitLoss } from "@/lib/finance";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { pdfResponse, renderPdf, type PdfTable } from "@/lib/pdf";
import { SOURCE_LABEL } from "@/lib/validation/finance";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Laporan keuangan sebagai PDF: jenis laba-rugi, neraca, arus-kas, margin. Parameter: dari, sampai, kelompok. */
export async function GET(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (!can(ctx, "finance_reports", "view", false)) return Response.json({ error: "Anda tidak punya izin." }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const today = todayWib();
  const jenis = q.get("jenis") ?? "laba-rugi";
  const from = DATE.test(q.get("dari") ?? "") ? q.get("dari")! : `${today.slice(0, 7)}-01`;
  const to = DATE.test(q.get("sampai") ?? "") ? q.get("sampai")! : today;
  const group = (({ jasa: "service", barang: "item", wo: "wo" }) as Record<string, "service" | "item" | "wo">)[q.get("kelompok") ?? "jasa"] ?? "service";
  const rp = formatRupiah;
  const right = ["l", "l", "r"] as ("l" | "r")[];

  let title = "";
  let subtitle = `${formatDate(from)} s/d ${formatDate(to)}`;
  const tables: PdfTable[] = [];
  let totals: [string, string][] | undefined;

  if (jenis === "laba-rugi") {
    title = "Laporan laba rugi";
    const rows = await getProfitLoss(from, to);
    const sum = summarizeProfitLoss(rows);
    const block = (label: string, sec: string) => ({ title: label, head: ["Kode", "Uraian", "Jumlah"], rows: rows.filter((r) => r.section === sec).map((r) => [r.code, r.name, rp(r.amount)]), widths: [1.2, 5, 2], align: right });
    tables.push(block("Pendapatan (tanpa PPN)", "revenue"), block("Harga pokok penjualan", "cogs"), block("Beban usaha", "expense"), block("Pendapatan (beban) lain", "other"), block("Pajak penghasilan", "tax"));
    totals = [["Total pendapatan", rp(sum.revenue)], ["Laba kotor", rp(sum.grossProfit)], ["Laba usaha", rp(sum.operatingProfit)], ["Laba sebelum pajak", rp(sum.beforeTax)], ["Laba bersih", rp(sum.net)]];
  } else if (jenis === "neraca") {
    title = "Neraca";
    subtitle = `Per ${formatDate(to)}`;
    const rows = await getBalanceSheet(to);
    for (const [label, sec] of [["Aset", "asset"], ["Kewajiban", "liability"], ["Modal", "equity"]] as const) {
      const items = rows.filter((r) => r.section === sec);
      tables.push({ title: label, head: ["Kode", "Uraian", "Jumlah"], rows: [...items.map((r) => [r.code, r.name, rp(r.amount)]), ["", `Total ${label.toLowerCase()}`, rp(items.reduce((t, r) => t + r.amount, 0))]], widths: [1.2, 5, 2], align: right, boldRows: [items.length] });
    }
  } else if (jenis === "arus-kas") {
    title = "Laporan arus kas";
    const rows = await getCashFlow(from, to);
    for (const [label, cat] of [["Arus kas dari operasi", "operating"], ["Arus kas dari investasi", "investing"], ["Arus kas dari pendanaan", "financing"]] as const) {
      const items = rows.filter((r) => r.category === cat);
      if (items.length === 0) continue;
      tables.push({
        title: label,
        head: ["Uraian", "Masuk", "Keluar", "Bersih"],
        rows: items.map((r) => [SOURCE_LABEL[r.source_type] ?? r.source_type, rp(r.inflow), rp(r.outflow), rp(r.inflow - r.outflow)]),
        widths: [4, 2, 2, 2],
        align: ["l", "r", "r", "r"],
      });
    }
    totals = [["Kenaikan (penurunan) kas bersih", rp(rows.reduce((t, r) => t + r.inflow - r.outflow, 0))]];
  } else if (jenis === "margin") {
    title = `Margin per ${group === "service" ? "jasa" : group === "item" ? "barang" : "work order"}`;
    const rows = await getMargin(group, from, to);
    tables.push({
      head: ["Nama", "Kode / plat", "Jumlah", "Pendapatan", "HPP", "Margin"],
      rows: rows.map((r) => [r.label, r.sublabel ?? "", String(r.qty), rp(r.revenue), rp(r.cost), rp(r.margin)]),
      widths: [4, 2, 1, 2, 2, 2],
      align: ["l", "l", "r", "r", "r", "r"],
    });
  } else {
    return Response.json({ error: "Jenis laporan tidak dikenal." }, { status: 400 });
  }

  const bytes = await renderPdf({ shop: ctx.branch.name, title, subtitle, tables, totals });
  return pdfResponse(bytes, `${title} ${to}`);
}

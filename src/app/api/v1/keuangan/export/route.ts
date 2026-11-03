import ExcelJS from "exceljs";
import { can, getUserContext } from "@/lib/auth";
import { getBalanceSheet, getCashFlow, getMargin, getProfitLoss, listCashBankBalances, summarizeProfitLoss } from "@/lib/finance";
import { addDays, todayWib } from "@/lib/format";
import { getPpnDocuments, getPpnSummary } from "@/lib/tax";
import { SOURCE_LABEL } from "@/lib/validation/finance";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const RP = '#,##0;[Red]-#,##0';

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5878" } };
}

/** Ekspor laporan keuangan ke Excel (PRD §11.4). Parameter: jenis, dari, sampai, kelompok. */
export async function GET(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  const jenisParam = new URL(request.url).searchParams.get("jenis");
  if (!can(ctx, "finance_reports", "view", false) && !(jenisParam === "ppn" && can(ctx, "tax_settings", "view", false))) return Response.json({ error: "Anda tidak punya izin." }, { status: 403 });

  const url = new URL(request.url);
  const today = todayWib();
  const jenis = url.searchParams.get("jenis") ?? "laba-rugi";
  const from = DATE.test(url.searchParams.get("dari") ?? "") ? url.searchParams.get("dari")! : `${today.slice(0, 7)}-01`;
  const to = DATE.test(url.searchParams.get("sampai") ?? "") ? url.searchParams.get("sampai")! : today;
  const group = (({ jasa: "service", barang: "item", wo: "wo" }) as Record<string, "service" | "item" | "wo">)[url.searchParams.get("kelompok") ?? "jasa"] ?? "service";

  const wb = new ExcelJS.Workbook();
  wb.creator = "AutoMobi";
  let title = "";

  if (jenis === "laba-rugi") {
    title = `Laba rugi ${from} sd ${to}`;
    const rows = await getProfitLoss(from, to);
    const sum = summarizeProfitLoss(rows);
    const ws = wb.addWorksheet("Laba rugi");
    ws.columns = [{ width: 12 }, { width: 44 }, { width: 20 }];
    ws.addRow([`Laba rugi ${from} s/d ${to}`]).font = { bold: true, size: 13 };
    styleHeader(ws.addRow(["Kode", "Uraian", "Jumlah (Rp)"]));
    const section = (label: string, sec: string) => {
      ws.addRow(["", label]).font = { bold: true };
      for (const r of rows.filter((x) => x.section === sec)) ws.addRow([r.code, r.name, r.amount]);
    };
    const total = (label: string, v: number) => {
      const r = ws.addRow(["", label, v]);
      r.font = { bold: true };
    };
    section("Pendapatan (tanpa PPN)", "revenue");
    total("Total pendapatan", sum.revenue);
    section("Harga pokok penjualan", "cogs");
    total("Laba kotor", sum.grossProfit);
    section("Beban usaha", "expense");
    total("Laba usaha", sum.operatingProfit);
    section("Pendapatan (beban) lain", "other");
    total("Laba sebelum pajak", sum.beforeTax);
    section("Pajak penghasilan", "tax");
    total("Laba bersih setelah pajak", sum.net);
    ws.getColumn(3).numFmt = RP;
  } else if (jenis === "neraca") {
    title = `Neraca ${to}`;
    const rows = await getBalanceSheet(to);
    const ws = wb.addWorksheet("Neraca");
    ws.columns = [{ width: 12 }, { width: 44 }, { width: 20 }];
    ws.addRow([`Neraca per ${to}`]).font = { bold: true, size: 13 };
    styleHeader(ws.addRow(["Kode", "Uraian", "Jumlah (Rp)"]));
    for (const [label, sec] of [["Aset", "asset"], ["Kewajiban", "liability"], ["Modal", "equity"]] as const) {
      ws.addRow(["", label]).font = { bold: true };
      for (const r of rows.filter((x) => x.section === sec)) ws.addRow([r.code, r.name, r.amount]);
      const t = ws.addRow(["", `Total ${label.toLowerCase()}`, rows.filter((x) => x.section === sec).reduce((s, x) => s + x.amount, 0)]);
      t.font = { bold: true };
    }
    ws.getColumn(3).numFmt = RP;
  } else if (jenis === "arus-kas") {
    title = `Arus kas ${from} sd ${to}`;
    const [rows, opening, closing] = await Promise.all([getCashFlow(from, to), listCashBankBalances(addDays(from, -1)), listCashBankBalances(to)]);
    const ws = wb.addWorksheet("Arus kas");
    ws.columns = [{ width: 36 }, { width: 18 }, { width: 18 }, { width: 18 }];
    ws.addRow([`Arus kas ${from} s/d ${to} (metode langsung)`]).font = { bold: true, size: 13 };
    styleHeader(ws.addRow(["Uraian", "Masuk", "Keluar", "Bersih"]));
    ws.addRow(["Saldo kas & bank awal", null, null, opening.reduce((t, b) => t + b.balance, 0)]).font = { bold: true };
    for (const [label, cat] of [["Arus kas dari operasi", "operating"], ["Arus kas dari investasi", "investing"], ["Arus kas dari pendanaan", "financing"]] as const) {
      const items = rows.filter((r) => r.category === cat);
      const h = ws.addRow([label, items.reduce((t, r) => t + r.inflow, 0), items.reduce((t, r) => t + r.outflow, 0), items.reduce((t, r) => t + r.inflow - r.outflow, 0)]);
      h.font = { bold: true };
      for (const r of items) ws.addRow([`   ${SOURCE_LABEL[r.source_type] ?? r.source_type}`, r.inflow, r.outflow, r.inflow - r.outflow]);
    }
    ws.addRow(["Kenaikan (penurunan) kas bersih", null, null, rows.reduce((t, r) => t + r.inflow - r.outflow, 0)]).font = { bold: true };
    ws.addRow(["Saldo kas & bank akhir", null, null, closing.reduce((t, b) => t + b.balance, 0)]).font = { bold: true };
    for (const c of [2, 3, 4]) ws.getColumn(c).numFmt = RP;
  } else if (jenis === "ppn") {
    title = `PPN ${from} sd ${to}`;
    const [sum, docs] = await Promise.all([getPpnSummary(from, to), getPpnDocuments(from, to)]);
    const ws = wb.addWorksheet("PPN");
    ws.columns = [{ width: 12 }, { width: 18 }, { width: 20 }, { width: 32 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }];
    ws.addRow([`Laporan PPN ${from} s/d ${to}`]).font = { bold: true, size: 13 };
    ws.addRow(["PPN Keluaran", sum.keluaran]);
    ws.addRow(["PPN Masukan", sum.masukan]);
    ws.addRow([sum.selisih >= 0 ? "Kurang bayar" : "Lebih bayar", Math.abs(sum.selisih)]).font = { bold: true };
    ws.addRow(["Sudah disetor", sum.disetor]);
    ws.addRow([]);
    styleHeader(ws.addRow(["Tanggal", "Jenis", "Nomor", "Pihak", "NPWP", "DPP", "PPN", "Total"]));
    const label = { keluaran: "Keluaran", retur_keluaran: "Retur (Keluaran)", masukan: "Masukan" } as const;
    for (const d of docs) ws.addRow([d.doc_date, label[d.kind], d.doc_no, d.party, d.npwp ?? "", d.dpp, d.ppn, d.total]);
    for (const c of [2, 6, 7, 8]) ws.getColumn(c).numFmt = RP;
  } else if (jenis === "margin") {
    title = `Margin ${group} ${from} sd ${to}`;
    const rows = await getMargin(group, from, to);
    const ws = wb.addWorksheet("Margin");
    ws.columns = [{ width: 36 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 10 }];
    ws.addRow([`Margin ${from} s/d ${to}`]).font = { bold: true, size: 13 };
    styleHeader(ws.addRow(["Nama", "Kode / plat", "Jumlah", "Pendapatan", "HPP", "Margin", "%"]));
    for (const r of rows) ws.addRow([r.label, r.sublabel, r.qty, r.revenue, r.cost, r.margin, r.revenue > 0 ? Math.round((r.margin / r.revenue) * 1000) / 10 : null]);
    for (const c of [4, 5, 6]) ws.getColumn(c).numFmt = RP;
  } else {
    return Response.json({ error: "Jenis laporan tidak dikenal." }, { status: 400 });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${title.replace(/[^A-Za-z0-9._-]+/g, "_")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

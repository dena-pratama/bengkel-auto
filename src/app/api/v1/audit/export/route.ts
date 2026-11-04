import ExcelJS from "exceljs";
import { EXPORT_LIMIT, exportAuditLogs } from "@/lib/audit";
import { can, getUserContext } from "@/lib/auth";
import { addDays, todayWib } from "@/lib/format";
import { ACTION_LABEL, TABLE_LABEL, diffFields, showValue, tableLabel } from "@/lib/validation/audit";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ekspor audit log ke Excel. Parameter sama dengan halaman: dari, sampai, tabel, aksi, pelaku. */
export async function GET(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (!can(ctx, "audit_log", "view", false)) return Response.json({ error: "Anda tidak punya izin." }, { status: 403 });

  const q = new URL(request.url).searchParams;
  const today = todayWib();
  const from = DATE.test(q.get("dari") ?? "") ? q.get("dari")! : addDays(today, -6);
  const to = DATE.test(q.get("sampai") ?? "") && q.get("sampai")! >= from ? q.get("sampai")! : today;
  const table = q.get("tabel") && TABLE_LABEL[q.get("tabel")!] ? q.get("tabel")! : null;
  const action = q.get("aksi") && ACTION_LABEL[q.get("aksi")!] ? q.get("aksi")! : null;
  const actor = UUID.test(q.get("pelaku") ?? "") ? q.get("pelaku")! : null;

  const { rows, truncated } = await exportAuditLogs({ from, to, table, action, actor });
  const wb = new ExcelJS.Workbook();
  wb.creator = "AutoMobi";
  const ws = wb.addWorksheet("Audit log");
  ws.columns = [{ width: 20 }, { width: 22 }, { width: 14 }, { width: 24 }, { width: 38 }, { width: 24 }, { width: 40 }, { width: 40 }];
  ws.addRow([`Audit log ${from} s/d ${to}`]).font = { bold: true, size: 13 };
  if (truncated) ws.addRow([`Hanya ${EXPORT_LIMIT} catatan terbaru yang diekspor. Persempit rentang tanggal untuk melihat sisanya.`]);
  const header = ws.addRow(["Waktu (WIB)", "Pelaku", "Aksi", "Data", "ID data", "Kolom", "Sebelum", "Sesudah"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5878" } };
  const when = new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Jakarta" });
  for (const r of rows) {
    const base = [when.format(new Date(r.created_at)), r.actor_name ?? "Sistem", ACTION_LABEL[r.action] ?? r.action, tableLabel(r.table_name), r.record_id ?? ""];
    const changes = r.action === "ai_tool_call" ? Object.entries(r.new_data ?? {}).map(([field, v]) => ({ field, before: null, after: v })) : diffFields(r.old_data, r.new_data);
    if (changes.length === 0) ws.addRow([...base, r.note ?? "", "", ""]);
    for (const c of changes) ws.addRow([...base, c.field, c.before === null ? "" : showValue(c.before), showValue(c.after)]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Audit_log_${from}_sd_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

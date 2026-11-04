import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronDown, Download, Lock } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { AuditRow } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { ACTION_LABEL, diffFields, showValue, tableLabel } from "@/lib/validation/audit";
import { cn } from "@/lib/utils";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Auditor", position: "Internal Auditor", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "Auditor" }],
  permissions: [],
};

const SAMPLE_LOGS: AuditRow[] = [
  {
    id: "aud-1",
    actor_name: "Budi Santoso",
    action: "insert",
    table_name: "sales",
    record_id: "sl-1234",
    old_data: null,
    new_data: { sale_no: "POS-2611-0012", grand_total: 450000, payment_status: "paid" },
    note: "Penjualan POS selesai",
    created_at: "2026-11-04T15:03:00Z",
  },
  {
    id: "aud-2",
    actor_name: "Siti Rahma",
    action: "update",
    table_name: "work_orders",
    record_id: "wo-5678",
    old_data: { status: "diagnosing", estimated_hours: 2 },
    new_data: { status: "in_progress", estimated_hours: 2.5 },
    note: "Status WO maju ke Pengerjaan",
    created_at: "2026-11-04T14:09:00Z",
  },
  {
    id: "aud-3",
    actor_name: "Maya Anggraini",
    action: "ai_tool_call",
    table_name: "ai_tool_calls",
    record_id: null,
    old_data: null,
    new_data: { tool: "get_financial_summary", params: { period: "month" } },
    note: "Pemanggilan tool Gemini",
    created_at: "2026-11-04T09:48:00Z",
  },
  {
    id: "aud-4",
    actor_name: "Budi Santoso",
    action: "update",
    table_name: "cash_bank_accounts",
    record_id: "cba-1",
    old_data: { balance: 4070000 },
    new_data: { balance: 4820000 },
    note: "Penyelarasan saldo kas laci",
    created_at: "2026-11-03T11:20:00Z",
  },
];

const ACTION_STYLE: Record<string, string> = {
  insert: "bg-brand-green-soft text-brand-green",
  update: "bg-brand-blue-soft text-brand-blue-fg",
  delete: "bg-brand-red-soft text-brand-red",
  void: "bg-brand-red-soft text-brand-red",
  ai_tool_call: "bg-brand-sand-soft text-brand-sand",
};

export default function AuditPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau audit log...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <PageHeader
          title="Audit log"
          description="7 hari terakhir · 4 catatan aktivitas"
          actions={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Download className="size-4" />
              Ekspor Excel
            </button>
          }
        />

        {/* Security Notice Banner */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-xs text-muted-foreground">
          <Lock className="size-4 shrink-0 text-foreground" />
          <p className="min-w-0">
            Catatan ini tidak bisa diubah atau dihapus dari aplikasi. Setiap perubahan data, persetujuan, dan panggilan AI tercatat otomatis.
          </p>
        </div>

        <section className={cn(panel, "p-4 sm:p-5")}>
          <ul className="grid divide-y divide-border">
            {SAMPLE_LOGS.map((r) => {
              const changes = r.action === "ai_tool_call" ? [] : diffFields(r.old_data, r.new_data);
              const params = r.action === "ai_tool_call" && r.new_data ? Object.entries(r.new_data) : [];
              return (
                <li key={r.id} className="py-3">
                  <details className="group" open={r.id === "aud-2"}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 hover:text-brand-rail">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
                          ACTION_STYLE[r.action] ?? "bg-muted"
                        )}
                      >
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                        {tableLabel(r.table_name)}
                        {r.note && <span className="font-normal text-muted-foreground"> · {r.note}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.actor_name ?? "Sistem"} · {formatDateTime(r.created_at)}
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-muted/40 p-3.5">
                      {changes.length === 0 && params.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Tidak ada rincian perubahan kolom.</p>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead className="text-muted-foreground border-b border-border">
                            <tr>
                              <th className="pr-3 pb-1.5 font-medium">Kolom</th>
                              {changes.length > 0 && <th className="pr-3 pb-1.5 font-medium">Sebelum</th>}
                              <th className="pb-1.5 font-medium">{changes.length > 0 ? "Sesudah" : "Nilai"}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {changes.map((c) => (
                              <tr key={c.field} className="align-top">
                                <td className="py-1.5 pr-3 font-mono font-medium whitespace-nowrap text-foreground">{c.field}</td>
                                <td className="py-1.5 pr-3 break-all text-brand-red">{showValue(c.before)}</td>
                                <td className="py-1.5 break-all text-brand-green">{showValue(c.after)}</td>
                              </tr>
                            ))}
                            {params.map(([k, v]) => (
                              <tr key={k} className="align-top">
                                <td className="py-1.5 pr-3 font-mono font-medium whitespace-nowrap text-foreground">{k}</td>
                                <td className="py-1.5 break-all text-foreground">{showValue(v)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {r.record_id && (
                        <p className="mt-2 text-[10px] text-muted-foreground font-mono">
                          ID data: {r.record_id}
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

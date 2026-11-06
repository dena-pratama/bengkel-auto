import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown, Download, History, Lock } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE, listAuditActors, listAuditLogs, type AuditRow } from "@/lib/audit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatDateTime, todayWib } from "@/lib/format";
import { describeRange, readRange } from "@/lib/list-filter";
import { ListFilter } from "@/components/list-filter";
import { ACTION_LABEL, TABLE_LABEL, diffFields, showValue, tableLabel } from "@/lib/validation/audit";
import { cn } from "@/lib/utils";

export default function AuditPage({ searchParams }: PageProps<"/audit">) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

const ACTION_STYLE: Record<string, string> = {
  insert: "bg-brand-green-soft text-brand-green",
  update: "bg-brand-blue-soft text-brand-blue-fg",
  delete: "bg-brand-red-soft text-brand-red",
  void: "bg-brand-red-soft text-brand-red",
  ai_tool_call: "bg-brand-sand-soft text-brand-sand",
};

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "audit_log", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "7-hari");
  const from = range.from ?? "2000-01-01";
  const to = range.to ?? today;
  const table = pick(sp.tabel) && TABLE_LABEL[pick(sp.tabel)!] ? pick(sp.tabel)! : null;
  const action = pick(sp.aksi) && ACTION_LABEL[pick(sp.aksi)!] ? pick(sp.aksi)! : null;
  const actor = UUID.test(pick(sp.pelaku) ?? "") ? pick(sp.pelaku)! : null;
  const page = Math.max(0, Math.min(500, Number(pick(sp.hal) ?? 0) || 0));
  const actors = await listAuditActors();

  const exportParams = new URLSearchParams({ dari: from, sampai: to });
  if (table) exportParams.set("tabel", table);
  if (action) exportParams.set("aksi", action);
  if (actor) exportParams.set("pelaku", actor);
  const exportHref = `/api/v1/audit/export?${exportParams}`;

  const query = (p: number) => {
    const q = new URLSearchParams({ dari: from, sampai: to, hal: String(p) });
    if (table) q.set("tabel", table);
    if (action) q.set("aksi", action);
    if (actor) q.set("pelaku", actor);
    return `/audit?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`${describeRange(range, formatDate)}. Catatan ini tidak bisa diubah atau dihapus dari aplikasi.`}
        actions={
          <Button variant="outline" nativeButton={false} render={<a href={exportHref} />}>
            <Download className="size-4" /> Ekspor Excel
          </Button>
        }
      />

      {/* Security Notice Banner matching Figma */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5 text-xs text-muted-foreground">
        <Lock className="size-4 shrink-0 text-foreground" />
        <p className="min-w-0">
          Catatan ini tidak bisa diubah atau dihapus dari aplikasi. Setiap perubahan data, persetujuan, dan panggilan AI tercatat otomatis.
        </p>
      </div>

      <ListFilter
        today={today}
        range={range}
        defaultRange="7-hari"
        extraParams={["hal"]}
        selects={[
          {
            name: "tabel",
            label: "Data",
            value: table,
            options: Object.entries(TABLE_LABEL)
              .sort((x, y) => x[1].localeCompare(y[1], "id"))
              .map(([value, label]) => ({ value, label })),
            allLabel: "Semua data",
          },
          {
            name: "aksi",
            label: "Aksi",
            value: action,
            options: Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label })),
            allLabel: "Semua aksi",
          },
          {
            name: "pelaku",
            label: "Pelaku",
            value: actor,
            options: actors.map((x) => ({ value: x.id, label: x.name })),
            allLabel: "Semua karyawan",
          },
        ]}
      />

      <Suspense fallback={<Skeleton className="h-96" />}>
        <Rows filter={{ from, to, table, action, actor, page }} query={query} />
      </Suspense>
    </>
  );
}

async function Rows({ filter, query }: { filter: Parameters<typeof listAuditLogs>[0]; query: (p: number) => string }) {
  const { rows, hasMore } = await listAuditLogs(filter);
  return (
    <section className={cn(panel, "p-4 sm:p-5")}>
      {rows.length === 0 ? (
        <EmptyState icon={History} text="Tidak ada catatan pada filter ini." />
      ) : (
        <ul className="grid divide-y divide-border">
          {rows.map((r) => (
            <Entry key={r.id} r={r} />
          ))}
        </ul>
      )}
      {(filter.page > 0 || hasMore) && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm border-t border-border pt-3">
          {filter.page > 0 ? (
            <Link href={query(filter.page - 1)} className="font-medium text-brand-blue-fg hover:underline">
              Lebih baru
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            Halaman {filter.page + 1} ({PAGE_SIZE} per halaman)
          </span>
          {hasMore ? (
            <Link href={query(filter.page + 1)} className="font-medium text-brand-blue-fg hover:underline">
              Lebih lama
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}

function Entry({ r }: { r: AuditRow }) {
  const changes = r.action === "ai_tool_call" ? [] : diffFields(r.old_data, r.new_data);
  const params = r.action === "ai_tool_call" && r.new_data ? Object.entries(r.new_data) : [];
  return (
    <li className="py-3">
      <details className="group">
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
}

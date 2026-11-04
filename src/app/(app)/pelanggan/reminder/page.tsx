import { Suspense } from "react";
import { BellRing } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { can, requireUser } from "@/lib/auth";
import { listDueReminders, listReminderRules, listServiceOptions } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { CustomersNav } from "../_components/lists";
import { ReminderRow, RuleDialog } from "./_components";

export default function ReminderPage({ searchParams }: PageProps<"/pelanggan/reminder">) {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <CustomersNav active="reminder" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const WINDOWS = [7, 14, 30, 60];

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "customers", "view")) return <NoAccess />;
  const sp = await searchParams;
  const asked = Number(typeof sp.hari === "string" ? sp.hari : 7);
  const days = WINDOWS.includes(asked) ? asked : 7;
  const canRules = can(ctx, "master_data", "update", false);
  const [due, rules, services] = await Promise.all([listDueReminders(days), listReminderRules(), canRules ? listServiceOptions() : Promise.resolve([])]);

  return (
    <>
      <PageHeader title="Reminder servis" description="Kendaraan yang perlu dihubungi untuk servis berkala. Pesan dikirim lewat WhatsApp Anda (klik-ke-chat)." />
      <section className={cn(panel, "grid gap-4")}>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Jatuh tempo dalam
            <select name="hari" defaultValue={String(days)} className={inputClass}>
              {WINDOWS.map((d) => (
                <option key={d} value={d}>
                  {d} hari
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Tampilkan</Button>
          <span className="text-sm text-muted-foreground">{due.length} kendaraan</span>
        </form>
        {due.length === 0 ? (
          <EmptyState icon={BellRing} text={rules.some((r) => r.is_active) ? "Tidak ada kendaraan yang perlu dihubungi dalam jangka ini." : "Belum ada aturan reminder. Tambahkan aturan di bawah."} />
        ) : (
          <ul className="grid divide-y divide-border">
            {due.map((r) => (
              <ReminderRow key={`${r.rule_id}-${r.vehicle_id}`} r={r} shop={ctx.branch.name} canMark={can(ctx, "customers", "update", false)} />
            ))}
          </ul>
        )}
      </section>

      <section className={cn(panel, "grid gap-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Aturan reminder</h2>
            <p className="text-sm text-muted-foreground">Contoh: ganti oli tiap 5.000 km atau 3 bulan, mana yang lebih dulu. Km diperkirakan dari rata-rata pemakaian kendaraan.</p>
          </div>
          {canRules && <RuleDialog services={services} />}
        </div>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada aturan.</p>
        ) : (
          <ul className="grid divide-y divide-border">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.service_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.interval_km ? `tiap ${r.interval_km.toLocaleString("id-ID")} km` : null, r.interval_months ? `tiap ${r.interval_months} bulan` : null].filter(Boolean).join(" atau ")}
                  </p>
                </div>
                {!r.is_active && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Nonaktif</span>}
                {canRules && <RuleDialog services={services} rule={r} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

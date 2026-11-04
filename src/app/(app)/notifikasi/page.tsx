import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Info, OctagonAlert } from "lucide-react";
import { ListFilter } from "@/components/list-filter";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDateTime, formatDate, todayWib } from "@/lib/format";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { NOTIFICATION_PAGE, recentNotifications, searchNotifications } from "@/lib/notifications";
import { NOTIFICATION_GROUPS, NOTIFICATION_GROUP_KEYS, SEVERITIES, SEVERITY_LABEL, type Severity } from "@/lib/validation/notifications";
import { cn } from "@/lib/utils";
import { MarkAllRead } from "./_components";

export default function NotificationsPage({ searchParams }: PageProps<"/notifikasi">) {
  return (
    <div className="mx-auto grid w-full max-w-[900px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const ICON: Record<Severity, typeof Info> = { info: Info, warn: AlertTriangle, danger: OctagonAlert };
const TONE: Record<Severity, string> = {
  info: "bg-brand-blue-soft text-brand-blue-fg",
  warn: "bg-brand-sand-soft text-foreground",
  danger: "bg-brand-red-soft text-brand-red",
};

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "notifications", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "7-hari");
  const group = readOption(sp, "kategori", NOTIFICATION_GROUP_KEYS);
  const severity = readOption(sp, "tingkat", SEVERITIES);
  const page = Math.max(0, Math.min(200, Number(typeof sp.hal === "string" ? sp.hal : 0) || 0));
  const [{ items, hasMore }, summary] = await Promise.all([searchNotifications({ from: range.from, to: range.to, group, severity, page }), recentNotifications(1)]);
  const lastRead = summary.lastReadAt ? new Date(summary.lastReadAt).getTime() : 0;

  const qs = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "hal") q.set(k, v);
    q.set("hal", String(p));
    return `/notifikasi?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description={`${describeRange(range, formatDate)} · ${summary.unread} belum dibaca. Merekam aksi penting di semua modul sesuai akses Anda.`}
        actions={<MarkAllRead disabled={summary.unread === 0} />}
      />
      <ListFilter
        today={today}
        range={range}
        defaultRange="7-hari"
        extraParams={["hal"]}
        selects={[
          { name: "kategori", label: "Kategori", value: group, options: NOTIFICATION_GROUP_KEYS.map((k) => ({ value: k, label: NOTIFICATION_GROUPS[k].label })), allLabel: "Semua kategori" },
          { name: "tingkat", label: "Tingkat", value: severity, options: SEVERITIES.map((v) => ({ value: v, label: SEVERITY_LABEL[v] })), allLabel: "Semua tingkat" },
        ]}
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {items.length === 0 ? (
          <EmptyState icon={Bell} text="Tidak ada notifikasi pada filter ini." />
        ) : (
          <ul className="grid divide-y divide-border">
            {items.map((n) => {
              const Icon = ICON[n.severity];
              const unread = new Date(n.created_at).getTime() > lastRead;
              const body = (
                <>
                  <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", TONE[n.severity])}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
                    {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDateTime(n.created_at)}
                      {n.actor_name && ` · ${n.actor_name}`}
                    </span>
                  </span>
                  {unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-red" aria-label="Belum dibaca" />}
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="flex gap-3 py-3 hover:bg-muted/40">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {(page > 0 || hasMore) && (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm">
            {page > 0 ? (
              <Link href={qs(page - 1)} className="font-medium text-brand-blue-fg">
                Lebih baru
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Halaman {page + 1} ({NOTIFICATION_PAGE} per halaman)
            </span>
            {hasMore ? (
              <Link href={qs(page + 1)} className="font-medium text-brand-blue-fg">
                Lebih lama
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
      {can(ctx, "employees", "update", false) && (
        <p className="text-sm text-muted-foreground">
          Siapa yang boleh melihat notifikasi diatur per peran di{" "}
          <Link href="/karyawan/role" className="font-medium text-brand-blue-fg hover:underline">
            Karyawan, Role
          </Link>{" "}
          (baris Notifikasi). Isinya tetap tersaring akses modul tiap pengguna.
        </p>
      )}
    </>
  );
}

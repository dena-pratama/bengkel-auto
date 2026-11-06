import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Info,
  OctagonAlert,
  Wrench,
  Receipt,
  Package,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { ListFilter } from "@/components/list-filter";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDateTime, formatDate, todayWib } from "@/lib/format";
import { describeRange, readOption, readRange } from "@/lib/list-filter";
import { NOTIFICATION_PAGE, recentNotifications, searchNotifications } from "@/lib/notifications";
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_GROUP_KEYS,
  SEVERITIES,
  SEVERITY_LABEL,
  timeAgo,
  type NotificationItem,
  type Severity,
} from "@/lib/validation/notifications";
import { cn } from "@/lib/utils";
import { MarkAllRead } from "./_components";

export default function NotificationsPage({ searchParams }: PageProps<"/notifikasi">) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function getNotificationVisuals(module: string | null, severity: Severity) {
  if (severity === "danger") {
    return {
      Icon: OctagonAlert,
      tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    };
  }
  if (severity === "warn") {
    return {
      Icon: AlertTriangle,
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    };
  }
  if (module?.includes("service") || module?.includes("part_issue")) {
    return {
      Icon: Wrench,
      tone: "bg-brand-blue-soft text-brand-blue border border-brand-blue-border",
    };
  }
  if (module?.includes("sales") || module?.includes("cash")) {
    return {
      Icon: Receipt,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    };
  }
  if (module?.includes("stock") || module?.includes("master_data")) {
    return {
      Icon: Package,
      tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
    };
  }
  if (module?.includes("expense") || module?.includes("journal") || module?.includes("tax")) {
    return {
      Icon: Wallet,
      tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    };
  }
  return {
    Icon: Bell,
    tone: "bg-brand-blue-soft text-brand-blue border border-brand-blue-border",
  };
}

function groupNotificationsByDay(items: NotificationItem[], todayStr: string) {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  const todayDate = new Date(`${todayStr}T00:00:00+07:00`);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  for (const item of items) {
    const itemDate = item.created_at.split("T")[0];
    let label = formatDate(item.created_at).toUpperCase();
    if (itemDate === todayStr) {
      label = `HARI INI : ${label}`;
    } else if (itemDate === yesterdayStr) {
      label = `KEMARIN : ${label}`;
    }
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireUser();
  if (!can(ctx, "notifications", "view", false)) return <NoAccess />;
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "7-hari");
  const group = readOption(sp, "kategori", NOTIFICATION_GROUP_KEYS);
  const severity = readOption(sp, "tingkat", SEVERITIES);
  const page = Math.max(0, Math.min(200, Number(typeof sp.hal === "string" ? sp.hal : 0) || 0));
  const [{ items, hasMore }, summary] = await Promise.all([
    searchNotifications({ from: range.from, to: range.to, group, severity, page }),
    recentNotifications(1),
  ]);
  const lastRead = summary.lastReadAt ? new Date(summary.lastReadAt).getTime() : 0;

  const qs = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "hal") q.set(k, v);
    q.set("hal", String(p));
    return `/notifikasi?${q}`;
  };

  const dayGroups = groupNotificationsByDay(items, today);

  return (
    <>
      <PageHeader
        title="Notifikasi"
        description={`${describeRange(range, formatDate)} · ${summary.unread} belum dibaca. Merekam aksi penting di semua modul sesuai akses Anda.`}
        actions={<MarkAllRead disabled={summary.unread === 0} />}
      />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
        <ListFilter
          today={today}
          range={range}
          defaultRange="7-hari"
          extraParams={["hal"]}
          selects={[
            {
              name: "kategori",
              label: "Kategori",
              value: group,
              options: NOTIFICATION_GROUP_KEYS.map((k) => ({ value: k, label: NOTIFICATION_GROUPS[k].label })),
              allLabel: "Semua kategori",
            },
            {
              name: "tingkat",
              label: "Tingkat",
              value: severity,
              options: SEVERITIES.map((v) => ({ value: v, label: SEVERITY_LABEL[v] })),
              allLabel: "Semua tingkat",
            },
          ]}
        />
      </div>

      <section className={cn(panel, "overflow-hidden rounded-2xl p-0 shadow-xs")}>
        {items.length === 0 ? (
          <div className="p-8">
            <EmptyState icon={BellOff} text="Tidak ada notifikasi pada filter ini." />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {dayGroups.map((groupItem) => (
              <div key={groupItem.label}>
                <div className="border-y border-border/40 bg-muted/40 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {groupItem.label}
                </div>
                <ul className="divide-y divide-border/30">
                  {groupItem.items.map((n) => {
                    const { Icon, tone } = getNotificationVisuals(n.module, n.severity);
                    const unread = new Date(n.created_at).getTime() > lastRead;

                    const rowContent = (
                      <div className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/40 sm:px-5">
                        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
                          <Icon className="size-5" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm leading-snug", unread ? "font-bold text-foreground" : "font-medium text-foreground/90")}>
                                {n.title}
                              </span>
                              {unread && (
                                <span className="size-2 shrink-0 rounded-full bg-brand-red ring-2 ring-background" aria-label="Belum dibaca" />
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>

                          {n.body && (
                            <p className="text-xs text-muted-foreground sm:text-sm">
                              {n.body}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            {n.module && (
                              <span className="inline-flex items-center rounded-full bg-brand-blue-soft px-2.5 py-0.5 font-semibold text-brand-blue">
                                {n.module}
                              </span>
                            )}
                            {n.severity !== "info" && (
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 font-semibold",
                                  n.severity === "danger"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                )}
                              >
                                {SEVERITY_LABEL[n.severity]}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {formatDateTime(n.created_at)}
                              {n.actor_name && ` · ${n.actor_name}`}
                            </span>
                          </div>
                        </div>

                        {n.link && (
                          <div className="mt-2 hidden shrink-0 text-muted-foreground sm:block">
                            <ChevronRight className="size-4" />
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <li key={n.id}>
                        {n.link ? (
                          <Link href={n.link} className="block">
                            {rowContent}
                          </Link>
                        ) : (
                          rowContent
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {(page > 0 || hasMore) && (
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3.5 text-xs font-medium sm:text-sm">
            {page > 0 ? (
              <Link href={qs(page - 1)} className="font-semibold text-brand-blue hover:underline">
                &larr; Lebih baru
              </Link>
            ) : (
              <span className="text-muted-foreground/50">&larr; Lebih baru</span>
            )}
            <span className="text-muted-foreground">
              Halaman {page + 1} ({NOTIFICATION_PAGE} per halaman)
            </span>
            {hasMore ? (
              <Link href={qs(page + 1)} className="font-semibold text-brand-blue hover:underline">
                Lebih lama &rarr;
              </Link>
            ) : (
              <span className="text-muted-foreground/50">Lebih lama &rarr;</span>
            )}
          </div>
        )}
      </section>

      {can(ctx, "employees", "update", false) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-blue" />
          <span>
            Siapa yang boleh melihat notifikasi diatur per peran di{" "}
            <Link href="/karyawan/role" className="font-semibold text-brand-blue hover:underline">
              Karyawan &rsaquo; Role
            </Link>{" "}
            (baris Notifikasi). Isinya tetap tersaring akses modul tiap pengguna.
          </span>
        </div>
      )}
    </>
  );
}

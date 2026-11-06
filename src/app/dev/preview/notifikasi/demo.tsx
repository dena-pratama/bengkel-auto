"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { NotificationBanner, NotificationBell } from "@/components/notification-bell";
import {
  Bell,
  BellOff,
  Wrench,
  Receipt,
  Package,
  Wallet,
  AlertTriangle,
  OctagonAlert,
  Info,
  CheckCheck,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo, type NotificationItem, type Severity } from "@/lib/validation/notifications";
import { cn } from "@/lib/utils";

const NOW = Date.now();
const SAMPLE_ITEMS: NotificationItem[] = [
  {
    id: "notif-1",
    kind: "wo_created",
    module: "service_orders",
    severity: "info",
    title: "Work Order Baru: WO-2611-0014",
    body: "WO-2611-0014 · B 1932 TKA · Andi (Tune Up & Ganti Oli)",
    link: "/servis/x",
    created_at: new Date(NOW - 10 * 60_000).toISOString(),
    actor_name: "Budi Mekanik",
  },
  {
    id: "notif-2",
    kind: "sale_posted",
    module: "sales",
    severity: "info",
    title: "Invoice INV-2026-0042 diposting",
    body: "Rp 825.000 · B 8829 TYA · Lunas Transfer BCA",
    link: "/kasir/penjualan/x",
    created_at: new Date(NOW - 45 * 60_000).toISOString(),
    actor_name: "Dewi Kasir",
  },
  {
    id: "notif-3",
    kind: "stock_low",
    module: "master_data",
    severity: "warn",
    title: "Peringatan Stok Menipis",
    body: "Oli Mesin Shell Helix Ultra 5W-40 tersisa 2 botol (minimum 5)",
    link: "/inventory/barang/x",
    created_at: new Date(NOW - 3 * 3600_000).toISOString(),
    actor_name: null,
  },
  {
    id: "notif-4",
    kind: "shift_closed",
    module: "cash_shift",
    severity: "warn",
    title: "Shift Kasir SHF-0007 Ditutup",
    body: "Dewi Kasir · Saldo akhir Rp 2.450.000 (Selisih +Rp 5.000)",
    link: "/kasir/shift/x",
    created_at: new Date(NOW - 18 * 3600_000).toISOString(),
    actor_name: "Dewi Kasir",
  },
  {
    id: "notif-5",
    kind: "period_reopened",
    module: "journal",
    severity: "danger",
    title: "Buku Periode Ditutup Dibuka Kembali",
    body: "Periode 2026-09 dibuka kembali untuk koreksi jurnal penyesuaian",
    link: "/keuangan/jurnal",
    created_at: new Date(NOW - 26 * 3600_000).toISOString(),
    actor_name: "Tama Pratama",
  },
  {
    id: "notif-6",
    kind: "po_approved",
    module: "purchasing",
    severity: "info",
    title: "Purchase Order Disetujui: PO-2611-0005",
    body: "Supplier PT Astra Otoparts Tbk · Estimasi tiba 6 Nov 2026",
    link: "/pembelian/po/x",
    created_at: new Date(NOW - 28 * 3600_000).toISOString(),
    actor_name: "Tama Pratama",
  },
];

// Data contoh menggantikan API (dipasang sebelum komponen mengambil data)
if (typeof window !== "undefined" && !(window as unknown as { __notifDemo?: boolean }).__notifDemo) {
  (window as unknown as { __notifDemo?: boolean }).__notifDemo = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/v1/notifications")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            enabled: true,
            items: SAMPLE_ITEMS,
            unread: 3,
            lastReadAt: new Date(NOW - 20 * 60_000).toISOString(),
          }),
          { headers: { "content-type": "application/json" } },
        ),
      );
    }
    return original(input, init);
  };
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

export function Demo() {
  const [banner, setBanner] = useState(true);
  const [emptyMode, setEmptyMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"semua" | "servis" | "kasir" | "stok">("semua");

  const filteredItems = emptyMode
    ? []
    : SAMPLE_ITEMS.filter((item) => {
        if (activeTab === "servis") return item.module?.includes("service");
        if (activeTab === "kasir") return item.module?.includes("sales") || item.module?.includes("cash");
        if (activeTab === "stok") return item.module?.includes("stock") || item.module?.includes("master_data");
        return true;
      });

  const todayItems = filteredItems.filter((i) => i.id === "notif-1" || i.id === "notif-2" || i.id === "notif-3" || i.id === "notif-4");
  const yesterdayItems = filteredItems.filter((i) => i.id === "notif-5" || i.id === "notif-6");

  return (
    <main className="min-h-svh space-y-8 bg-background p-6">
      {/* Top Demo Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-blue-soft text-brand-blue">
            <Sparkles className="size-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Figma Page 16</span>
            <h2 className="text-sm font-semibold text-foreground">Pratinjau Modul Notifikasi (Popover & Halaman Penuh)</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEmptyMode(!emptyMode)}
            className="rounded-xl text-xs"
          >
            {emptyMode ? "Lihat Halaman Berisi" : "Lihat Halaman Kosong"}
          </Button>

          {/* Bel Notifikasi dengan popover */}
          <NotificationBell enabled />
        </div>
      </div>

      <AnimatePresence>
        {banner && (
          <NotificationBanner
            key="sample-banner"
            item={SAMPLE_ITEMS[0]}
            onClose={() => setBanner(false)}
            onOpen={() => setBanner(false)}
          />
        )}
      </AnimatePresence>

      {/* Tampilan Halaman Notifikasi Penuh (/notifikasi) */}
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Notifikasi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              7 hari terakhir · 3 belum dibaca. Merekam aksi penting di semua modul sesuai akses Anda.
            </p>
          </div>
          <Button variant="outline" className="rounded-xl text-xs font-semibold">
            <CheckCheck className="size-4" /> Tandai semua dibaca
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("semua")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                activeTab === "semua"
                  ? "bg-brand-blue text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("servis")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                activeTab === "servis"
                  ? "bg-brand-blue text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              Servis & Part
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("kasir")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                activeTab === "kasir"
                  ? "bg-brand-blue text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              Kasir & Penjualan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("stok")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                activeTab === "stok"
                  ? "bg-brand-blue text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              Stok & Gudang
            </button>
          </div>

          <div className="text-xs text-muted-foreground">
            Menampilkan <span className="font-semibold text-foreground">{filteredItems.length}</span> notifikasi
          </div>
        </div>

        {/* List Card */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <BellOff className="size-7" />
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">Tidak ada notifikasi pada filter ini</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Semua notifikasi telah dibaca atau filter pencarian tidak menemukan kecocokan.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {todayItems.length > 0 && (
                <div>
                  <div className="border-y border-border/40 bg-muted/40 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    HARI INI : 4 NOV 2026
                  </div>
                  <ul className="divide-y divide-border/30">
                    {todayItems.map((n) => {
                      const { Icon, tone } = getNotificationVisuals(n.module, n.severity);
                      const isUnread = n.id === "notif-1" || n.id === "notif-2" || n.id === "notif-3";
                      return (
                        <li key={n.id} className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/40 sm:px-5">
                          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
                            <Icon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm leading-snug", isUnread ? "font-bold text-foreground" : "font-medium text-foreground/90")}>
                                  {n.title}
                                </span>
                                {isUnread && (
                                  <span className="size-2 shrink-0 rounded-full bg-brand-red ring-2 ring-background" aria-label="Belum dibaca" />
                                )}
                              </div>
                              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                            </div>
                            {n.body && <p className="text-xs text-muted-foreground sm:text-sm">{n.body}</p>}
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
                                  {n.severity === "danger" ? "Penting" : "Perlu perhatian"}
                                </span>
                              )}
                              <span className="text-muted-foreground">{n.actor_name ? `Oleh ${n.actor_name}` : "Sistem otomatis"}</span>
                            </div>
                          </div>
                          <div className="mt-2 hidden shrink-0 text-muted-foreground sm:block">
                            <ChevronRight className="size-4" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {yesterdayItems.length > 0 && (
                <div>
                  <div className="border-y border-border/40 bg-muted/40 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    KEMARIN : 3 NOV 2026
                  </div>
                  <ul className="divide-y divide-border/30">
                    {yesterdayItems.map((n) => {
                      const { Icon, tone } = getNotificationVisuals(n.module, n.severity);
                      return (
                        <li key={n.id} className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/40 sm:px-5">
                          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
                            <Icon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-sm font-medium text-foreground/90">{n.title}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                            </div>
                            {n.body && <p className="text-xs text-muted-foreground sm:text-sm">{n.body}</p>}
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
                                  {n.severity === "danger" ? "Penting" : "Perlu perhatian"}
                                </span>
                              )}
                              <span className="text-muted-foreground">{n.actor_name ? `Oleh ${n.actor_name}` : "Sistem otomatis"}</span>
                            </div>
                          </div>
                          <div className="mt-2 hidden shrink-0 text-muted-foreground sm:block">
                            <ChevronRight className="size-4" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Info Note Banner */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-blue" />
          <span>
            Siapa yang boleh melihat notifikasi diatur per peran di Karyawan › Role (baris Notifikasi). Isinya tetap tersaring akses modul tiap pengguna.
          </span>
        </div>
      </div>
    </main>
  );
}

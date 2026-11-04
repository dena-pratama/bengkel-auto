"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { NotificationBanner, NotificationBell } from "@/components/notification-bell";
import type { NotificationItem } from "@/lib/validation/notifications";

const NOW = Date.now();
const ITEMS: NotificationItem[] = [
  { id: "1", kind: "sale_posted", module: "sales", severity: "info", title: "Invoice INV-2026-0042 diposting", body: "Rp 237.500 · B 7788 TES", link: "/kasir/penjualan/x", created_at: new Date(NOW - 2 * 60_000).toISOString(), actor_name: "Dewi Kasir" },
  { id: "2", kind: "stock_low", module: "master_data", severity: "warn", title: "Stok menipis: Filter oli Avanza", body: "Tersisa 4 (minimum 5) · FLTR-OLI-AVNZA-01", link: "/inventory/barang/x", created_at: new Date(NOW - 25 * 60_000).toISOString(), actor_name: null },
  { id: "3", kind: "shift_close", module: "cash_shift", severity: "warn", title: "Shift SHF-0007 ditutup", body: "Dewi Kasir · selisih kas Rp 5.000", link: "/kasir/shift/x", created_at: new Date(NOW - 3 * 3600_000).toISOString(), actor_name: "Dewi Kasir" },
  { id: "4", kind: "period_reopened", module: "journal", severity: "danger", title: "Buku 2026-09 dibuka kembali", body: "Koreksi jurnal penyesuaian", link: null, created_at: new Date(NOW - 30 * 3600_000).toISOString(), actor_name: "Tama Pratama" },
];

// Data contoh menggantikan API (dipasang sebelum komponen mengambil data)
if (typeof window !== "undefined" && !(window as unknown as { __notifDemo?: boolean }).__notifDemo) {
  (window as unknown as { __notifDemo?: boolean }).__notifDemo = true;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/v1/notifications")) {
      return Promise.resolve(new Response(JSON.stringify({ enabled: true, items: ITEMS, unread: 3, lastReadAt: new Date(NOW - 20 * 60_000).toISOString() }), { headers: { "content-type": "application/json" } }));
    }
    return original(input, init);
  };
}

export function Demo() {
  const [banner, setBanner] = useState(true);
  return (
    <main className="min-h-svh p-6">
      <div className="flex justify-end">
        <NotificationBell enabled />
      </div>
      <AnimatePresence>{banner && <NotificationBanner key="b" item={ITEMS[0]} onClose={() => setBanner(false)} onOpen={() => setBanner(false)} />}</AnimatePresence>
    </main>
  );
}

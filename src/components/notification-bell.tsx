"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Bell, CheckCheck, Info, OctagonAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { timeAgo, type NotificationItem, type Severity } from "@/lib/validation/notifications";
import { cn } from "@/lib/utils";

type Payload = { enabled: boolean; items: NotificationItem[]; unread: number; lastReadAt: string | null };

const ICON: Record<Severity, typeof Info> = { info: Info, warn: AlertTriangle, danger: OctagonAlert };
const TONE: Record<Severity, string> = {
  info: "bg-brand-blue-soft text-brand-blue-fg",
  warn: "bg-brand-sand-soft text-foreground",
  danger: "bg-brand-red-soft text-brand-red",
};

/** Banner notifikasi baru: turun dari atas layar, hilang sendiri (diatur pemanggil). Dipakai di dalam AnimatePresence. */
export function NotificationBanner({ item, onClose, onOpen }: { item: NotificationItem; onClose: () => void; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const Icon = ICON[item.severity];
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -72 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -72 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
      className="fixed top-3 left-1/2 z-[60] w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2"
      role="status"
    >
      <div className="flex items-start gap-3 rounded-2xl bg-card p-3 pr-2 shadow-2xl shadow-brand-blue-deep/25 ring-1 ring-black/5">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", TONE[item.severity])}>
          <Icon className="size-4" />
        </span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <span className="block text-sm font-semibold">{item.title}</span>
          {item.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>}
        </button>
        <Button variant="ghost" size="icon" aria-label="Tutup banner" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function Row({ n, unread, onOpen }: { n: NotificationItem; unread: boolean; onOpen: () => void }) {
  const Icon = ICON[n.severity];
  const inner = (
    <>
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", TONE[n.severity])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
          {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-red" aria-label="Belum dibaca" />}
        </span>
        {n.body && <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
        <span className="mt-0.5 block text-2xs text-muted-foreground">
          {timeAgo(n.created_at)}
          {n.actor_name && ` · ${n.actor_name}`}
        </span>
      </span>
    </>
  );
  const cls = "flex gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-muted/70";
  return n.link ? (
    <Link href={n.link} onClick={onOpen} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * Bel notifikasi: panel meluncur turun dari bel, dan notifikasi baru muncul sebagai banner yang turun dari atas
 * (langsung, lewat Supabase Realtime). Hanya tampil bila peran diizinkan; isinya sudah disaring izin modul oleh database.
 */
export function NotificationBell({ enabled }: { enabled: boolean }) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<NotificationItem | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const seen = useRef<Set<string>>(new Set());

  // muat awal + langganan realtime: ada notifikasi baru, muat ulang dan tampilkan banner
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const pull = () =>
      fetch("/api/v1/notifications", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Payload>) : null))
        .then((p) => {
          if (live && p) setData(p);
          return p;
        })
        .catch(() => null);
    void pull().then((p) => p?.items.forEach((i) => seen.current.add(i.id)));
    const supabase = createClient();
    const channel = supabase.channel("notifications-bell").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
      void pull().then((p) => {
        if (!live || !p) return;
        const fresh = p.items.find((i) => !seen.current.has(i.id));
        p.items.forEach((i) => seen.current.add(i.id));
        if (fresh) setBanner(fresh);
      });
    });
    channel.subscribe();
    // cadangan bila koneksi realtime putus
    const t = setInterval(() => void pull(), 60_000);
    return () => {
      live = false;
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [enabled]);

  // banner hilang sendiri
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(t);
  }, [banner]);

  // tutup panel: klik di luar atau Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled) return null;

  const unread = data?.unread ?? 0;
  const lastRead = data?.lastReadAt ? new Date(data.lastReadAt).getTime() : 0;
  const markRead = async () => {
    await fetch("/api/v1/notifications/read", { method: "POST" });
    setData((d) => (d ? { ...d, unread: 0, lastReadAt: new Date().toISOString() } : d));
  };
  const slide = reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : { initial: { opacity: 0, y: -14, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -10, scale: 0.98 } };

  return (
    <div ref={wrap} className="relative">
      <Button variant="outline" size="icon" className="relative size-10 text-muted-foreground" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-background">{unread > 99 ? "99+" : unread}</span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...slide}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
            style={{ transformOrigin: "top right" }}
            className="fixed top-[60px] right-3 left-3 z-50 flex max-h-[min(70svh,34rem)] flex-col overflow-hidden rounded-3xl bg-card shadow-2xl shadow-brand-blue-deep/20 ring-1 ring-black/5 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-[26rem]"
            role="dialog"
            aria-label="Notifikasi"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
              <h2 className="text-base font-semibold">Notifikasi</h2>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => void markRead()}>
                    <CheckCheck className="size-4" /> Tandai dibaca
                  </Button>
                )}
                <Button variant="ghost" size="icon" aria-label="Tutup" onClick={() => setOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
              {data === null ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Memuat...</p>
              ) : data.items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi. Aksi penting di bengkel akan tercatat di sini.</p>
              ) : (
                data.items.map((n) => <Row key={n.id} n={n} unread={new Date(n.created_at).getTime() > lastRead} onOpen={() => setOpen(false)} />)
              )}
            </div>
            <Link href="/notifikasi" onClick={() => setOpen(false)} className="border-t border-border px-4 py-3 text-center text-sm font-medium text-brand-blue-fg hover:bg-muted/60">
              Lihat semua notifikasi
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {banner && !open && (
          <NotificationBanner
            key={banner.id}
            item={banner}
            onClose={() => setBanner(null)}
            onOpen={() => {
              setBanner(null);
              setOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

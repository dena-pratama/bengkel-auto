"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { EngineStartButton } from "@/components/engine-start-button";
import { Tachometer } from "@/components/tachometer";
import { ThemeToggle } from "@/components/topbar-controls";
import { cn } from "@/lib/utils";

type Step = "off" | "ignition" | "login";

const IDLE_RPM = 0.8;
const REV_RPM = 8;

// Waktu mengikuti prototype Figma (Smart Animate, ease in-out)
const SWEEP_MS = 900; // START ditekan: jarum naik ke 8.0
const HOLD_MS = 300; // jeda di Ignition
const MORPH_MS = 1100; // Ignition ke Login
const STOP_MS = 600; // tombol START kecil: kembali ke mesin mati

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** Animasi angka 0..8 dengan easing in-out; mengembalikan nilai berjalan dan fungsi `to(target, ms)` */
function useTween(initial: number) {
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const raf = useRef(0);
  const to = useCallback((target: number, ms: number) => {
    cancelAnimationFrame(raf.current);
    const from = current.current;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const next = from + (target - from) * easeInOut(p);
      current.current = next;
      setValue(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return [value, to] as const;
}

type VtDocument = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<unknown> } };

/** Ganti tampilan dengan transisi "smart animate" (View Transitions); tanpa dukungan browser: langsung ganti */
function morph(update: () => void, fast = false) {
  const doc = document as VtDocument;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduce) {
    update();
    return;
  }
  const root = document.documentElement;
  const cls = fast ? "login-vt-fast" : "login-vt";
  root.classList.add(cls);
  const t = doc.startViewTransition(() => flushSync(update));
  const done = () => root.classList.remove(cls);
  t.finished.then(done, done);
}

/**
 * Halaman masuk bergaya "start mesin" (Figma "login UI anima"), mengikuti prototype:
 * 1. Mesin mati, tekan START. 2. Ignition: jarum naik ke 8.0 (0,9 dtk), tahan 0,3 dtk.
 * 3. Logo, tachometer, dan tombol bergeser ke posisi login (1,1 dtk) dan kartu muncul.
 * Tombol START kecil di pojok kanan atas mematikan mesin kembali (0,6 dtk).
 * Kartu `children` berisi form; selalu ter-mount agar pengelola password bekerja normal.
 */
export function LoginExperience({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<Step>("off");
  const [rpm, tweenTo] = useTween(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const start = useCallback(() => {
    if (step !== "off") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const focus = () => document.getElementById("email")?.focus({ preventScroll: true });
    if (reduce) {
      tweenTo(IDLE_RPM, 1);
      setStep("login");
      wait(50, focus);
      return;
    }
    setStep("ignition");
    tweenTo(REV_RPM, SWEEP_MS);
    wait(SWEEP_MS + HOLD_MS, () => {
      morph(() => setStep("login"));
      tweenTo(IDLE_RPM, MORPH_MS);
    });
    wait(SWEEP_MS + HOLD_MS + MORPH_MS, focus);
  }, [step, tweenTo]);

  const stop = useCallback(() => {
    if (step !== "login") return;
    morph(() => setStep("off"), true);
    tweenTo(0, STOP_MS);
    timers.current.push(window.setTimeout(() => document.getElementById("engine-start")?.focus({ preventScroll: true }), STOP_MS + 50));
  }, [step, tweenTo]);

  // Cahaya biru dan merah mengikuti pointer mouse (lerp halus; merah lebih lambat). Dimatikan di layar sentuh dan gerak-dikurangi.
  const blueRef = useRef<HTMLDivElement>(null);
  const redRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const blue = blueRef.current;
    const red = redRef.current;
    if (!blue || !red) return;
    const half = 280; // setengah ukuran cahaya (560 px)
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const b = { ...target };
    const r = { ...target };
    let raf = 0;
    const place = () => {
      blue.style.transform = `translate3d(${b.x - half - 70}px, ${b.y - half - 40}px, 0)`;
      red.style.transform = `translate3d(${r.x - half + 70}px, ${r.y - half + 40}px, 0)`;
    };
    const loop = () => {
      b.x += (target.x - b.x) * 0.16;
      b.y += (target.y - b.y) * 0.16;
      r.x += (target.x - r.x) * 0.07;
      r.y += (target.y - r.y) * 0.07;
      place();
      const moving = Math.abs(target.x - r.x) + Math.abs(target.y - r.y) > 0.6;
      raf = moving ? requestAnimationFrame(loop) : 0;
    };
    const move = (e: PointerEvent) => {
      target.x = e.pageX;
      target.y = e.pageY;
      blue.style.opacity = "1";
      red.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(loop);
    };
    place();
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  const onLogin = step === "login";
  const igniting = step === "ignition";
  const hidden = "invisible opacity-0";

  return (
    <div
      className="relative isolate flex min-h-[max(100svh,760px)] [--glow-a:20%] dark:[--glow-a:34%] flex-1 flex-col overflow-hidden bg-background"
      style={{ "--st": "max(4.5rem, calc(50svh - 340px))", "--lt": "max(5.5rem, calc(50svh - 300px))" } as React.CSSProperties}
    >
      {/* Cahaya latar: merah saat ignition, biru saat login */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700", igniting ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(ellipse 55% 45% at 50% 70%, color-mix(in oklab, #e0262b 30%, transparent), transparent 72%)" }}
      />
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 -z-10 transition-opacity duration-1000", onLogin ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(ellipse 50% 55% at 25% 60%, color-mix(in oklab, #1e6fd9 22%, transparent), transparent 70%)" }}
      />

      {/* Cahaya pengikut pointer */}
      <div
        ref={blueRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -z-10 size-[560px] rounded-full opacity-0 transition-opacity duration-700 will-change-transform max-lg:hidden"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, #1e6fd9 var(--glow-a, 26%), transparent), transparent 66%)" }}
      />
      <div
        ref={redRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -z-10 size-[560px] rounded-full opacity-0 transition-opacity duration-700 will-change-transform max-lg:hidden"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, #e0262b var(--glow-a, 22%), transparent), transparent 66%)" }}
      />

      {/* Toggle mode terang/gelap */}
      <div className={cn("absolute top-8 z-20 [view-transition-name:login-toggle] sm:top-9", onLogin ? "right-[88px] sm:right-[92px]" : "right-5 sm:right-6")}>
        <ThemeToggle />
      </div>

      {/* Logo */}
      <div
        className={cn(
          "absolute z-10 [view-transition-name:login-logo]",
          onLogin ? "top-5 left-5 w-28 lg:top-[var(--lt)] lg:left-1/4 lg:w-80 lg:-translate-x-1/2" : "top-[var(--st)] left-1/2 w-60 -translate-x-1/2",
        )}
      >
        <Image src="/brand/automobi-logo.png" alt="AutoMobi" width={671} height={335} className="h-auto w-full dark:hidden" priority />
        <Image src="/brand/automobi-logo-dark.png" alt="AutoMobi" width={671} height={335} className="hidden h-auto w-full dark:block" priority />
      </div>

      {/* Tagline (hanya layar lebar saat login) */}
      <p className={cn("absolute top-[calc(var(--lt)+165px)] left-1/4 z-10 hidden -translate-x-1/2 text-base whitespace-nowrap text-muted-foreground transition-opacity duration-700 lg:block", onLogin ? "opacity-100" : hidden)}>
        Bengkel &amp; servis mobil, dalam satu genggaman.
      </p>

      {/* Tachometer */}
      <div
        className={cn(
          "absolute z-10 -translate-x-1/2 [view-transition-name:login-gauge]",
          onLogin ? "top-[calc(var(--lt)+217px)] left-1/4 w-[270px] max-lg:hidden" : "top-[calc(var(--st)+140px)] left-1/2 w-[300px] max-w-[calc(100vw-2rem)]",
        )}
      >
        <Tachometer value={rpm} />
      </div>

      {/* Tombol START: besar di tengah, kecil di pojok kanan atas saat login */}
      <div className={cn("absolute z-20 [view-transition-name:login-button]", onLogin ? "top-5 right-5 sm:top-6 sm:right-6" : "top-[calc(var(--st)+446px)] left-1/2 -translate-x-1/2")}>
        <EngineStartButton
          size={onLogin ? 60 : 160}
          lit={onLogin || igniting}
          onClick={onLogin ? stop : start}
          autoFocus
          label={onLogin ? "Matikan mesin" : "Start mesin untuk masuk"}
          id="engine-start"
        />
      </div>

      {/* Petunjuk */}
      <p
        aria-live="polite"
        className={cn(
          "absolute top-[calc(var(--st)+446px+160px+28px)] left-1/2 z-10 -translate-x-1/2 text-[15px] whitespace-nowrap transition-[opacity,color] duration-500",
          onLogin ? hidden : "opacity-100",
          igniting ? "font-medium text-[#e0262b]" : "text-muted-foreground",
        )}
      >
        {igniting ? "Menyalakan mesin..." : "Injak rem & tekan START untuk masuk"}
      </p>

      {/* Kartu login */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pt-24 pb-16 lg:ml-[50%] lg:px-10 lg:pt-16" aria-hidden={!onLogin} inert={!onLogin}>
        <div className={cn("w-full max-w-[460px] rounded-3xl border-[1.5px] border-[#d92228] bg-card p-6 shadow-[0_0_0_4px_rgb(217_34_40/0.08),0_28px_60px_-28px_rgb(15_23_42/0.28)] sm:p-9", onLogin ? "visible opacity-100" : hidden)}>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Selamat datang kembali</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>

      <footer className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs text-muted-foreground">&copy; 2026 AutoMobi</footer>
    </div>
  );
}

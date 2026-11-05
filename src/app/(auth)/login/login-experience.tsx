"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { EngineStartButton } from "@/components/engine-start-button";
import { Tachometer } from "@/components/tachometer";
import { ThemeToggle } from "@/components/topbar-controls";
import { cn } from "@/lib/utils";

type Step = "off" | "ignition" | "login";

const IDLE_RPM = 0.8;
const REV_RPM = 8;

/** Animasi angka 0..8 dengan easing; mengembalikan nilai berjalan dan fungsi `to(target, ms)` */
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
      const next = from + (target - from) * (1 - Math.pow(1 - p, 3));
      current.current = next;
      setValue(next);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return [value, to] as const;
}

/**
 * Halaman masuk bergaya "start mesin" (Figma "login UI anima"):
 * 1. Mesin mati, tekan START. 2. Ignition: jarum naik ke 8.0. 3. Mesin nyala, form login.
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
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const focusEmail = () => document.getElementById("email")?.focus({ preventScroll: true });
    if (reduce) {
      tweenTo(IDLE_RPM, 1);
      setStep("login");
      later(50, focusEmail);
      return;
    }
    setStep("ignition");
    tweenTo(REV_RPM, 1200);
    later(1650, () => {
      setStep("login");
      tweenTo(IDLE_RPM, 1000);
    });
    later(2300, focusEmail);
  }, [step, tweenTo]);

  const onLogin = step === "login";
  const igniting = step === "ignition";
  const stageHidden = onLogin;

  return (
    <div className="relative isolate flex min-h-svh flex-1 flex-col overflow-hidden bg-background">
      {/* Cahaya latar: merah saat ignition, biru saat login */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 -z-10 transition-opacity duration-700", igniting ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(ellipse 55% 50% at 50% 74%, color-mix(in oklab, #e0262b 34%, transparent), transparent 70%)" }}
      />
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 -z-10 transition-opacity duration-1000", onLogin ? "opacity-100" : "opacity-0")}
        style={{ background: "radial-gradient(ellipse 50% 55% at 25% 60%, color-mix(in oklab, #1e6fd9 22%, transparent), transparent 70%)" }}
      />

      {/* Bilah atas: logo kecil di layar kecil saat login, toggle tema, indikator START */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-5 sm:p-6">
        <span className={cn("transition-opacity duration-700 lg:hidden", onLogin ? "opacity-100" : "opacity-0")}>
          <Image src="/brand/automobi-logo.png" alt="AutoMobi" width={671} height={335} className="h-12 w-auto dark:hidden" priority />
          <Image src="/brand/automobi-logo-dark.png" alt="AutoMobi" width={671} height={335} className="hidden h-12 w-auto dark:block" priority />
        </span>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <span className={cn("transition-[opacity,max-width,margin] duration-700", onLogin ? "max-w-[60px] opacity-100" : "-ml-3 max-w-0 opacity-0")}>
            <EngineStartButton size={60} lit />
          </span>
        </div>
      </header>

      <div className="grid flex-1 place-items-center">
        {/* Tahap 1 dan 2: logo, tachometer, tombol START */}
        <section
          aria-hidden={stageHidden}
          inert={stageHidden}
          className={cn(
            "col-start-1 row-start-1 flex w-full flex-col items-center px-4 pt-20 pb-16 transition-[opacity,scale,visibility] duration-700 motion-reduce:transition-none",
            stageHidden ? "invisible scale-95 opacity-0" : "visible scale-100 opacity-100",
          )}
        >
          <Image src="/brand/automobi-logo.png" alt="AutoMobi" width={671} height={335} className="h-auto w-56 dark:hidden sm:w-60" priority />
          <Image src="/brand/automobi-logo-dark.png" alt="AutoMobi" width={671} height={335} className="hidden h-auto w-56 sm:w-60 dark:block" priority />
          <Tachometer value={rpm} className="mt-5 w-[300px] max-w-full" />
          <EngineStartButton size={160} lit={igniting} onClick={start} autoFocus className="mt-8" />
          <p className={cn("mt-8 text-[15px] transition-colors duration-500", igniting ? "font-medium text-[#e0262b]" : "text-muted-foreground")} aria-live="polite">
            {igniting ? "Menyalakan mesin..." : "Injak rem & tekan START untuk masuk"}
          </p>
        </section>

        {/* Tahap 3: merek dan tachometer di kiri (layar lebar), kartu login di kanan */}
        <section
          aria-hidden={!onLogin}
          inert={!onLogin}
          className={cn(
            "col-start-1 row-start-1 grid w-full items-center gap-10 px-4 pt-24 pb-16 transition-[opacity,scale,visibility] duration-700 motion-reduce:transition-none lg:min-h-svh lg:grid-cols-2 lg:px-10 lg:pt-16",
            onLogin ? "visible scale-100 opacity-100 delay-300 motion-reduce:delay-0" : "invisible scale-105 opacity-0",
          )}
        >
          <div className="hidden flex-col items-center gap-3 lg:flex">
            <Image src="/brand/automobi-logo.png" alt="" width={671} height={335} className="h-auto w-80 dark:hidden" priority />
            <Image src="/brand/automobi-logo-dark.png" alt="" width={671} height={335} className="hidden h-auto w-80 dark:block" priority />
            <p className="text-base text-muted-foreground">Bengkel &amp; servis mobil, dalam satu genggaman.</p>
            <Tachometer value={rpm} className="mt-6 w-[270px]" />
          </div>
          <div className="mx-auto w-full max-w-[460px] rounded-3xl border border-border bg-card p-6 shadow-[0_28px_60px_-28px_rgb(15_23_42/0.28)] sm:p-9">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Selamat datang kembali</h1>
            <div className="mt-6">{children}</div>
          </div>
        </section>
      </div>

      <footer className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs text-muted-foreground">&copy; 2026 AutoMobi</footer>
    </div>
  );
}

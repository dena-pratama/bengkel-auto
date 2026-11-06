"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selesai navigasi: penuhkan bar lalu sembunyikan
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (el.style.opacity === "1") {
      el.style.width = "100%";
      timerRef.current = setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => {
          el.style.width = "0%";
        }, 200);
      }, 200);
    }
  }, [pathname, searchParams]);

  // Tangkap klik tautan internal untuk respon visual instan (<16ms)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.defaultPrevented
      ) {
        return;
      }

      const currentUrl = window.location.pathname + window.location.search;
      if (href === currentUrl) return;

      const el = barRef.current;
      if (!el) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      el.style.transition = "none";
      el.style.width = "0%";
      el.style.opacity = "1";

      void el.offsetWidth;

      el.style.transition = "width 300ms ease-out, opacity 200ms ease-out";
      el.style.width = "30%";

      timerRef.current = setTimeout(() => {
        el.style.transition = "width 600ms ease-out";
        el.style.width = "75%";
      }, 150);
    };

    window.addEventListener("click", handleClick, { capture: true });
    return () => {
      window.removeEventListener("click", handleClick, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 right-0 z-[100] h-[2.5px] bg-transparent"
    >
      <div
        ref={barRef}
        className="h-full bg-brand-blue shadow-[0_0_8px_rgba(37,99,235,0.7)]"
        style={{ width: "0%", opacity: 0 }}
      />
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Toaster } from "sonner";
import { readIsDark, subscribeTheme } from "@/components/topbar-controls";

/**
 * Lama tampil (ms), termasuk animasi masuk sekitar 0,4 detik. Konfirmasi biasa dibuat singkat;
 * yang punya tombol aksi atau perlu dibaca lebih lama. Di bawah ±1 detik toast sudah memudar sebelum terbaca.
 */
export const TOAST_MS = { quick: 1200, action: 3000, warning: 5000 } as const;

const base = "absolute inset-x-0 mx-auto flex w-fit max-w-[min(92vw,28rem)] items-center gap-3 rounded-full py-2.5 pr-5 pl-4 text-sm font-medium shadow-xl shadow-brand-blue-deep/25";

/**
 * Notifikasi (toast) di tengah layar. Sukses/info = biru logo, gagal = merah logo, peringatan = pasir.
 * Tanpa tombol tutup: toast hilang sendiri.
 */
export function AppToaster() {
  const dark = useSyncExternalStore(subscribeTheme, readIsDark, () => false);
  return (
    <Toaster
      position="top-center"
      offset={{ top: "calc(50dvh - 24px)" }}
      mobileOffset={{ top: "calc(50dvh - 24px)" }}
      theme={dark ? "dark" : "light"}
      duration={TOAST_MS.quick}
      visibleToasts={1}
      icons={{
        success: <CheckCircle2 className="size-5 shrink-0" />,
        error: <CircleAlert className="size-5 shrink-0" />,
        warning: <TriangleAlert className="size-5 shrink-0" />,
        info: <Info className="size-5 shrink-0" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: `${base} bg-brand-rail text-white ring-1 ring-white/10`,
          success: "bg-brand-rail! text-white!",
          info: "bg-brand-rail! text-white!",
          error: "bg-brand-red! text-white!",
          warning: "bg-brand-sand-soft! text-brand-sand! ring-brand-sand/30!",
          icon: "m-0! size-5! shrink-0",
          content: "min-w-0",
          title: "leading-snug",
          description: "text-xs font-normal opacity-80",
          actionButton: "ml-1 shrink-0 cursor-pointer rounded-full bg-white/18 px-3.5 py-1 text-[13px] font-semibold text-inherit transition-colors hover:bg-white/28",
        },
      }}
    />
  );
}

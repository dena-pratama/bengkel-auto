"use client";

import { useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { readIsDark, subscribeTheme } from "@/components/topbar-controls";

/** Notifikasi kecil (toast) yang mengikuti tema terang/gelap aplikasi */
export function AppToaster() {
  const dark = useSyncExternalStore(subscribeTheme, readIsDark, () => false);
  return <Toaster position="top-center" richColors closeButton theme={dark ? "dark" : "light"} toastOptions={{ className: "font-sans" }} />;
}

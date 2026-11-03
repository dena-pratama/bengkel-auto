"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/**
 * Sisipkan skrip tema ke HTML dari server saja (sebelum halaman tampil, tanpa kedipan).
 * Tidak pernah dirender React di browser, jadi tidak memicu peringatan
 * "Encountered a script tag while rendering React component".
 */
export function ThemeScript() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script id="theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
  });
  return null;
}

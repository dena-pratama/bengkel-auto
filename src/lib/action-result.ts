import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Pesan dari fungsi database kita sudah berbahasa Indonesia (raise exception). Pesan bawaan
// PostgreSQL (bahasa Inggris) dengan kode yang sama diganti pesan Indonesia per kode.
const KNOWN_DB_CODES = new Set(["42501", "22023", "23514", "23505", "P0001", "P0002"]);
const BUILTIN_MESSAGE = /^(permission denied|duplicate key|new row|null value|invalid input|value too long|insert or update)/i;
const FALLBACK: Record<string, string> = {
  "42501": "Anda tidak punya izin, atau sesi sudah berakhir. Silakan masuk lagi.",
  "23505": "Data yang sama sudah ada.",
  "23514": "Data tidak memenuhi aturan.",
  "22023": "Data tidak valid.",
};

export function dbError(error: PostgrestError, scope: string): { ok: false; error: string } {
  if (KNOWN_DB_CODES.has(error.code)) {
    if (!BUILTIN_MESSAGE.test(error.message)) return { ok: false, error: error.message };
    return { ok: false, error: FALLBACK[error.code] ?? "Data tidak valid." };
  }
  console.error(`[${scope}] database error`, error.code, error.message);
  return { ok: false, error: "Terjadi kesalahan saat menyimpan. Coba lagi." };
}

export const invalid = (issues: { message: string }[]) => ({ ok: false as const, error: issues[0].message });

export const done = <T = undefined>(data?: T): { ok: true; data: T } => ({ ok: true, data: data as T });

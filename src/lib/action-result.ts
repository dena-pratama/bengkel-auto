import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Pesan dari fungsi database sudah berbahasa Indonesia (raise exception); error lain disamarkan.
const KNOWN_DB_CODES = new Set(["42501", "22023", "23514", "23505", "P0001", "P0002"]);

export function dbError(error: PostgrestError, scope: string): { ok: false; error: string } {
  if (KNOWN_DB_CODES.has(error.code)) return { ok: false, error: error.message };
  console.error(`[${scope}] database error`, error.code, error.message);
  return { ok: false, error: "Terjadi kesalahan saat menyimpan. Coba lagi." };
}

export const invalid = (issues: { message: string }[]) => ({ ok: false as const, error: issues[0].message });

export const done = <T = undefined>(data?: T): { ok: true; data: T } => ({ ok: true, data: data as T });

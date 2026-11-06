import { addDays } from "@/lib/format";

// Filter daftar yang digerakkan URL: ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&rentang=semua&<nama kategori>=nilai
// Dipakai halaman server (membaca parameter) dan komponen ListFilter (menulis parameter).

export const RANGE_PRESETS = [
  { key: "hari-ini", label: "Hari ini" },
  { key: "7-hari", label: "7 hari" },
  { key: "30-hari", label: "30 hari" },
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "tahun-ini", label: "Tahun ini" },
  { key: "semua", label: "Semua" },
] as const;
export type RangeKey = (typeof RANGE_PRESETS)[number]["key"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function monthBounds(today: string, offset: number) {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

/** Rentang tanggal untuk satu pilihan cepat. "semua" = tanpa batas (from dan to null). */
export function presetRange(key: RangeKey, today: string): { from: string | null; to: string | null } {
  switch (key) {
    case "hari-ini":
      return { from: today, to: today };
    case "7-hari":
      return { from: addDays(today, -6), to: today };
    case "30-hari":
      return { from: addDays(today, -29), to: today };
    case "bulan-ini":
      return monthBounds(today, 0);
    case "bulan-lalu":
      return monthBounds(today, -1);
    case "tahun-ini":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "semua":
      return { from: null, to: null };
  }
}

export type RangeValue = { from: string | null; to: string | null; preset: RangeKey | null };
type Params = Record<string, string | string[] | undefined>;
const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Baca rentang dari parameter URL; tanpa parameter dipakai pilihan bawaan halaman. */
export function readRange(sp: Params, today: string, defaultKey: RangeKey): RangeValue {
  if (pick(sp.rentang) === "semua") return { ...presetRange("semua", today), preset: "semua" };
  const f = pick(sp.dari);
  const t = pick(sp.sampai);
  const from = f && DATE.test(f) ? f : null;
  const to = t && DATE.test(t) ? t : null;
  if (from || to) {
    const [a, b] = from && to && to < from ? [to, from] : [from, to];
    const preset = RANGE_PRESETS.find((p) => {
      const r = presetRange(p.key, today);
      return r.from === a && r.to === b;
    });
    return { from: a, to: b, preset: preset?.key ?? null };
  }
  return { ...presetRange(defaultKey, today), preset: defaultKey };
}

/** Baca satu pilihan kategori; nilai di luar daftar diabaikan (null = semua). */
export function readOption<T extends string>(sp: Params, name: string, allowed: readonly T[]): T | null {
  const v = pick(sp[name]);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Ringkasan rentang untuk deskripsi halaman, mis. "1 Nov 2026 s/d 30 Nov 2026" atau "Semua tanggal" */
export function describeRange(r: RangeValue, fmt: (d: string | null) => string): string {
  if (!r.from && !r.to) return "Semua tanggal";
  if (r.from && r.to) return r.from === r.to ? fmt(r.from) : `${fmt(r.from)} s/d ${fmt(r.to)}`;
  return r.from ? `Mulai ${fmt(r.from)}` : `Sampai ${fmt(r.to)}`;
}

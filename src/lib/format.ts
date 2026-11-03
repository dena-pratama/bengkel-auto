// Format Indonesia (PRD §19 aturan #12): Rupiah, angka, tanggal WIB.

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Angka dari database (numeric dikirim sebagai string/number) → Rupiah tanpa desimal */
export const formatRupiah = (v: number | string | null | undefined) => rupiah.format(Number(v ?? 0));
export const formatQty = (v: number | string | null | undefined) => qtyFmt.format(Number(v ?? 0));
export const formatDate = (v: string | null) => (v ? dateFmt.format(new Date(v)) : "-");
export const formatDateTime = (v: string) => `${dateTimeFmt.format(new Date(v))} WIB`;

/** Tanggal hari ini di WIB, format YYYY-MM-DD (untuk nilai default input date) */
export const todayWib = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

/** Lama waktu dalam menit -> "45 mnt", "2 j 15 mnt", "3 hr 4 j" */
export const formatDuration = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} mnt`;
  if (m < 1440) return `${Math.floor(m / 60)} j${m % 60 ? ` ${m % 60} mnt` : ""}`;
  return `${Math.floor(m / 1440)} hr${Math.floor((m % 1440) / 60) ? ` ${Math.floor((m % 1440) / 60)} j` : ""}`;
};

/** Tanggal YYYY-MM-DD ditambah n hari (tetap YYYY-MM-DD) */
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

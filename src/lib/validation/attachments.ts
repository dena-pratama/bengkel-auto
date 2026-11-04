// Aturan lampiran (sama di server dan klien): jenis dokumen, tipe berkas, ukuran.
export const ENTITY_TYPES = ["item", "goods_receipt", "cash_transaction", "employee_avatar"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PER_ENTITY = 10;
export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_MIMES: Record<EntityType, readonly string[]> = {
  item: IMAGE_MIMES,
  employee_avatar: IMAGE_MIMES,
  goods_receipt: [...IMAGE_MIMES, "application/pdf"],
  cash_transaction: [...IMAGE_MIMES, "application/pdf"],
};
export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

/** Cek tanda awal berkas (magic bytes) agar ekstensi/tipe yang dikirim klien tidak dipercaya begitu saja */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  return null;
}

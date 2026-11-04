// Format isi QR (PRD §4.3): hanya kode, tanpa harga. Awalan menandakan jenisnya.
//   I:<SKU>      barang
//   L:<KODE>     lokasi rak
// Pemindai USB/kamera juga boleh membaca kode batang yang isinya SKU polos.

export type QrKind = "item" | "location";
export type QrTarget = { kind: QrKind | "plain"; code: string };

const CODE = /^[A-Z0-9][A-Z0-9-]{0,29}$/;

export const itemQr = (sku: string) => `I:${sku}`;
export const locationQr = (code: string) => `L:${code}`;

export function parseQr(raw: string): QrTarget | null {
  const text = raw.trim().toUpperCase();
  const m = /^([IL]):(.+)$/.exec(text);
  if (m) return CODE.test(m[2]) ? { kind: m[1] === "I" ? "item" : "location", code: m[2] } : null;
  return CODE.test(text) ? { kind: "plain", code: text } : null;
}

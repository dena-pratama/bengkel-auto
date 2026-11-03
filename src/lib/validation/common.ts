/** Angka dari input teks format Indonesia: "45.000" / "45000" / "1,5" → number. Kosong → 0. */
export const toNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim().replace(/\s/g, "");
  if (s === "") return 0;
  // Titik = pemisah ribuan, koma = desimal
  return Number(s.replace(/\./g, "").replace(",", "."));
};

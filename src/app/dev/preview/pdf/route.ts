import { notFound } from "next/navigation";
import { pdfResponse, renderPdf } from "@/lib/pdf";

// Contoh PDF tanpa login, HANYA saat development (404 di production).
export async function GET() {
  if (process.env.NODE_ENV !== "development") notFound();
  const rows = Array.from({ length: 40 }, (_, i) => [String(i + 1), `FLTR-OLI-${i + 1}`, `Filter oli Avanza nomor ${i + 1} dengan deskripsi panjang untuk menguji pemenggalan baris di kolom nama barang`, "2 pcs", "Rp 95.000", `Rp ${(95000 * 2).toLocaleString("id-ID")}`]);
  const bytes = await renderPdf({
    shop: "Bengkel Pusat",
    title: "Purchase Order PO-2026-0001",
    subtitle: "Dicetak 4 Nov 2026",
    meta: [["Supplier", "CV Sumber Jaya"], ["Tanggal", "4 Nov 2026"], ["Status", "Terkirim"], ["Perkiraan datang", "10 Nov 2026"]],
    tables: [{ title: "Barang dipesan", head: ["No", "SKU", "Barang", "Jumlah", "Harga", "Subtotal"], rows, widths: [0.5, 2, 5, 1.2, 1.6, 1.8], align: ["l", "l", "l", "r", "r", "r"] }],
    totals: [["Subtotal", "Rp 7.600.000"], ["Total", "Rp 7.600.000"]],
    notes: ["Catatan: kirim sebelum Jumat. Karakter di luar Latin-1 seperti ≥ diganti tanda tanya."],
  });
  return pdfResponse(bytes, "contoh");
}

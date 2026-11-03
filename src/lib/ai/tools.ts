// Definisi tool AI Analyst (PRD §13.2). Dipakai bersama oleh server MCP dan fitur "Tanya AI" di aplikasi.
// Semua tool read-only dan dijalankan oleh fungsi database (public.ai_run_tool); AI tidak bisa menjalankan query bebas.

export type AiToolDef = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; additionalProperties: false };
};

const dateProp = (what: string) => ({ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: what });
const range = { from: dateProp("Tanggal awal (YYYY-MM-DD). Default awal bulan ini."), to: dateProp("Tanggal akhir (YYYY-MM-DD). Default hari ini.") };

export const AI_TOOLS: AiToolDef[] = [
  {
    name: "get_business_summary",
    description:
      "Ringkasan bisnis satu periode: omzet (jasa dan sparepart, tanpa PPN), HPP, laba kotor, beban usaha, laba bersih, margin, jumlah invoice dan work order, plus perbandingan dengan periode sebelumnya yang sama panjang.",
    inputSchema: { type: "object", properties: range, additionalProperties: false },
  },
  {
    name: "get_health_score",
    description:
      "Skor kesehatan bisnis 0-100 dari 9 indikator (margin kotor, margin bersih, ketahanan kas, perputaran stok, dead stock, kualitas piutang, pertumbuhan omzet, retensi pelanggan, kedisiplinan operasional) beserta status dan alasannya.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_sales_trend",
    description: "Tren penjualan (jasa dan sparepart) per hari, minggu, atau bulan pada rentang tanggal. Default 30 hari terakhir per hari.",
    inputSchema: { type: "object", properties: { ...range, granularity: { type: "string", enum: ["day", "week", "month"] } }, additionalProperties: false },
  },
  {
    name: "get_stock_alerts",
    description: "Peringatan stok: menipis, habis, dead stock (tanpa pemakaian 90 hari, dengan nilainya), dan overstock.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_top_items",
    description: "Jasa dan sparepart terlaris berdasarkan omzet, dan sparepart dengan margin tertinggi, pada satu periode.",
    inputSchema: { type: "object", properties: { ...range, limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false },
  },
  {
    name: "get_mechanic_performance",
    description: "Kinerja mekanik per periode: jumlah work order, jam kerja, omzet jasa, dan klaim garansi.",
    inputSchema: { type: "object", properties: range, additionalProperties: false },
  },
  {
    name: "get_cash_position",
    description: "Posisi kas dan bank saat ini, rata-rata biaya harian, dan berapa hari kas bertahan.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_receivables_payables",
    description: "Piutang pelanggan dan hutang supplier: total, umur (aging), yang lewat jatuh tempo.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_tax_summary",
    description: "Ringkasan pajak: PPN bulan ini (keluaran, masukan, kurang bayar) dan PPh Final UMKM (omzet kumulatif tahun ini, pemakaian batas Rp4,8 miliar).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_service_due_customers",
    description: "Kendaraan dan pelanggan yang sudah lama tidak servis (default lebih dari 3 bulan). Tidak memuat nomor HP atau alamat.",
    inputSchema: { type: "object", properties: { months: { type: "integer", minimum: 1, maximum: 36 }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false },
  },
  {
    name: "get_inventory_accuracy",
    description: "Akurasi stok dari sesi stok opname terakhir dan rata-rata 180 hari.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export const AI_TOOL_NAMES = new Set(AI_TOOLS.map((t) => t.name));

export const AI_SYSTEM_PROMPT = [
  "Kamu adalah AI Business Analyst untuk satu bengkel mobil. Jawab dalam Bahasa Indonesia yang ringkas dan jelas.",
  "Gunakan hanya angka yang kamu dapat dari tool. Jangan menebak. Sebutkan periode dan sumber angka (nama laporan) di setiap jawaban.",
  "Kalau data tidak cukup, katakan terus terang. Kamu hanya membaca data dan tidak bisa mengubah apa pun.",
  "Jangan meminta atau menyebut nomor HP dan alamat pelanggan. Format uang: Rp dengan pemisah ribuan titik.",
].join(" ");

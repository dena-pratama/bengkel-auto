/**
 * Data contoh untuk tampilan dashboard selama modul operasional belum dibangun.
 * Setiap blok nanti diganti view database (PRD §15.3): v_sales_daily, v_low_stock, v_ap_aging, v_health_score, dll.
 */

export const DEMO = true;

export const serviceToday = { masuk: 12, selesai: 7, diambil: 5 };

export const serviceFlow = [
  { key: "queue", label: "Antri", count: 3 },
  { key: "working", label: "Dikerjakan", count: 4 },
  { key: "waiting_part", label: "Menunggu Part", count: 1 },
  { key: "qc", label: "Quality Check", count: 2 },
  { key: "ready", label: "Siap Diambil", count: 2 },
] as const;

export const workshopStats = { avgDurationMin: 110, mechanicUtilization: 85 };

export const alerts = [
  { title: "WO melewati estimasi", body: "WO-2611-0014 · B 1932 TKA sudah 40 menit lewat estimasi durasi.", time: "13:48" },
  { title: "Stok menipis", body: "Filter Oli Avanza tersisa 3 pcs (minimum 10).", time: "11:20" },
];

export const activeWorkOrder = {
  number: "WO-2611-0012",
  customer: "Budi Santoso",
  plate: "B 1234 KJT",
  vehicle: "Toyota Avanza 1.3 G · 2019",
  km: 86420,
  estimate: 1_250_000,
  dpPaid: true,
  progress: 60,
  status: "Dikerjakan",
  mechanic: "Rudi",
  eta: "2026-11-03T16:00:00+07:00",
  serviceType: "Servis berkala 80.000 km",
};

export const bayCapacity = { used: 6, total: 8, mechanicsOnDuty: 5, liftsFree: 2 };

// Omzet 7 hari terakhir (jasa + part, tanpa PPN), indeks terakhir = hari ini
export const revenueTrend = [
  { day: "28.10", value: 6_200_000 },
  { day: "29.10", value: 7_900_000 },
  { day: "30.10", value: 5_400_000 },
  { day: "31.10", value: 9_100_000 },
  { day: "01.11", value: 8_400_000 },
  { day: "02.11", value: 4_300_000 },
  { day: "03.11", value: 7_200_000 },
];

export const healthScore = { score: 82, trend: [64, 70, 68, 74, 72, 79, 82] };

export const reminders = [
  { who: "Sistem", text: "5 kendaraan jatuh tempo servis berkala minggu ini.", action: "Kirim WA" },
  { who: "Pembelian", text: "Hutang ke PT Sumber Part Rp 4.750.000 jatuh tempo 06.11.", action: "Lihat" },
  { who: "Kasir", text: "Shift pagi ditutup dengan selisih Rp 0.", action: null },
];

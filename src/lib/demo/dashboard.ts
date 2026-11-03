/**
 * Data contoh untuk tampilan dashboard selama modul operasional belum dibangun.
 * Setiap blok nanti diganti view database (PRD §15.3): v_sales_daily, v_low_stock, v_ar_aging, v_mechanic_performance, dll.
 */

export const DEMO = true;

export const notifications = [
  {
    kind: "alert" as const,
    title: "WO melewati estimasi",
    meta: "WO-2611-0014 · B 1932 TKA",
    date: "Sel, 3 Nov",
    time: "13:48",
  },
  {
    kind: "message" as const,
    title: "Pesan | Supplier",
    meta: "dari PT Sumber Part",
    preview: "Filter oli Avanza sudah dikirim, estimasi tiba besok pagi…",
  },
];

export const mechanicJob = {
  category: "Servis berkala",
  plate: "B 1234 KJT",
  title: "Ganti oli, filter & tune up Toyota Avanza 2019",
  priority: "Mendesak",
  tag: "Paket Ganti Oli",
  mechanic: "Rudi",
};

export const agenda = [
  { slot: "09.00-10.00", title: "Booking servis Honda Jazz", meta: "09.00 - 10.00 · B 2210 SNA", icon: "car" as const },
  { slot: "13.30-14.30", title: "Terima barang dari supplier", meta: "13.30 - 14.30 · PO-2611-0007", icon: "truck" as const, urgent: true },
];

export const todayWorkOrders = [
  { title: "Tune up mesin bensin", plate: "B 1234 KJT", start: "3 Nov, 08.20", duration: "02 j 45 m", progress: 90, parts: 4, mechanic: "Rudi" },
  { title: "Ganti kampas rem depan", plate: "B 1932 TKA", start: "3 Nov, 09.05", duration: "01 j 30 m", progress: 50, parts: 2, mechanic: "Andi" },
  { title: "Servis AC & isi freon", plate: "D 1288 XB", start: "3 Nov, 10.40", duration: "01 j 15 m", progress: 10, parts: 3, mechanic: "Joko" },
];

export const lowStock = { count: 8, topItem: "Filter Oli Avanza", left: 3 };

export const targets = [
  { label: "Target omzet", group: "Bulan ini", pct: 72, note: "Rp 128 jt dari Rp 178 jt", tone: "blue" as const },
  { label: "Piutang tertagih", group: "Pelanggan fleet", pct: 65, note: "3 invoice belum lunas", tone: "red" as const, action: "Tagih" },
];

export const cashShift = {
  title: "Tutup kas shift pagi",
  time: "Hari ini, 16.00",
  detail: "Kasir: Sinta · Kas seharusnya Rp 4.820.000",
};

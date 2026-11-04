# Daftar Fitur Bengkel Mobil App

Status: ⬜ Belum · 🟨 Proses · ✅ Selesai · Versi saat ini: **0.51.0**

## Fondasi
| Fitur | Status | Versi |
|---|---|---|
| Supabase self-host di Coolify lokal | ✅ | 0.0.3 |
| Akses Postgres langsung (port 54322) untuk migration | ✅ | 0.0.4 |
| Setup proyek (Next.js, Tailwind, shadcn/ui, Supabase) | ✅ | 0.1.0 |
| Dockerfile standalone + endpoint `/api/v1/health` | ✅ | 0.1.0 |
| Skema dasar: branches, settings, number_sequences, audit_logs | ✅ | 0.2.0 |
| Akses: employees, profiles, roles, permissions, helper RLS, PIN persetujuan | ✅ | 0.2.0 |
| Auth (email + password), PIN persetujuan, auto-logout 12 jam | ✅ | 0.3.0 |
| Halaman login, setup Owner pertama, layout aplikasi & dashboard | ✅ | 0.3.0 |
| Tema biru & merah + dashboard bengkel responsif (data contoh) | ✅ | 0.3.3 |
| Sidebar melayang: bentang berlabel / ciut jadi rail ikon (Ctrl+B) | ✅ | 0.3.5 |
| Form tambah data sebagai pop-up + animasi halus (Motion) + toast | ✅ | 0.8.0 |
| Perpindahan halaman mulus: pil menu aktif meluncur + animasi masuk pegas (Motion) | ✅ | 0.11.1 |
| Tema moodboard default: bingkai gelap membulat, rail ikon, kartu putih membulat, warna merah & biru logo | ✅ | 0.11.2 |
| Kolom isian, tombol, dan pop-up form seragam & selaras tema | ✅ | 0.11.3 |
| Notifikasi (toast) di tengah layar, biru/merah logo, singkat | ✅ | 0.11.4 |
| Bingkai, sidebar, dan top bar diam saat scroll (hanya panel konten yang bergulir) | ✅ | 0.11.6 |
| Dark mode + toggle; menu profil (profil, pengaturan, keluar) di top bar | ✅ | 0.4.0 |
| Skala huruf lebih besar (min. 12px) + angka metrik menonjol | ✅ | 0.4.1 |
| Logo AutoMobi transparan (sidebar, login, favicon; varian mode gelap) | ✅ | 0.4.5 |

## MVP
| Modul | Fitur | Status | Versi |
|---|---|---|---|
| Master Data & Inventory | Barang (SKU otomatis, kategori 2 tingkat, merek, part number OEM/alternatif, garansi, PPN) | ✅ | 0.6.0 |
| | Kompatibilitas kendaraan (daftar per barang, pencarian dari nama kendaraan) | ✅ | 0.26.0 |
| | Lokasi Area > Rak > Bin, stok per lokasi, pindah lokasi | ✅ | 0.6.0 |
| | QR label barang dan rak (cetak thermal 30x20/50x30 mm atau A4) | ✅ | 0.19.0 |
| | Scan QR kamera/USB: halaman scan barang/rak, scan di pemilih barang | ✅ | 0.19.0 |
| | Konversi satuan | ✅ | 0.6.0 |
| | Foto barang | ✅ | 0.28.0 |
| | Master jasa & paket servis (alokasi harga proporsional) | ✅ | 0.6.0 |
| | Mutasi stok (ledger) + HPP rata-rata tertimbang + saldo awal + peringatan stok minimum | ✅ | 0.6.0 |
| Pembelian | Supplier, PO (saran dari stok menipis), penerimaan barang (dari PO / tanpa PO), HPP rata-rata, PPN masuk HPP / PPN Masukan | ✅ | 0.7.0 |
| | PO sebagai PDF (unduh, kirim manual lewat WhatsApp) | ✅ | 0.27.0 |
| | Foto faktur supplier | ✅ | 0.28.0 |
| | Retur ke supplier, hutang usaha (aging, jatuh tempo H-3) & pembayaran (sebagian / banyak faktur, batal) | ✅ | 0.7.0 |
| Pelanggan | Pelanggan & kendaraan relasional, riwayat kepemilikan | ✅ | 0.9.0 |
| | Riwayat servis per kendaraan (tanggal, km, jasa, part, mekanik, biaya, garansi) | ✅ | 0.10.0 |
| | Reminder servis berkala (aturan km/bulan per jasa, daftar kendaraan, klik-ke-WA) | ✅ | 0.25.0 |
| Servis | Estimasi (versi/revisi, kirim WA klik-ke-chat, persetujuan langsung/telepon/chat, masa berlaku, paket dipecah) | ✅ | 0.10.0 |
| | Work order dari estimasi (satu klik), pekerjaan tambahan wajib persetujuan, mekanik per jasa (porsi %), minta/keluar/kembali part + jurnal | ✅ | 0.10.0 |
| | Pengambilan part dengan scan QR (barang + rak diverifikasi, ditandai di riwayat, setelan wajib scan) | ✅ | 0.20.0 |
| | Papan status kanban (lama di status, tanda merah lewat durasi, layar penuh TV, segar tiap 30 detik) | ✅ | 0.10.0 |
| | Papan realtime (Supabase Realtime, cadangan polling 30 detik) | ✅ | 0.21.0 |
| | Garansi & klaim (WO garansi Rp0, biaya part ke Beban Garansi, masa garansi dari tanggal invoice) | ✅ | 0.22.0 |
| | Laporan klaim garansi per mekanik, barang, supplier | ✅ | 0.22.0 |
| | WO ditutup jadi invoice (wajib sebelum kendaraan diserahkan) | ✅ | 0.11.0 |
| Penjualan & Kas | POS part langsung (draft ditahan, pelanggan opsional), diskon per role + PIN Owner | ✅ | 0.11.0 |
| | POS dengan scan QR | ✅ | 0.19.0 |
| | Pembayaran fleksibel (split tunai/transfer/QRIS/EDC, DP dipotong otomatis, tempo + batas kredit) | ✅ | 0.11.0 |
| | Nota/invoice: cetak A4 dan nota thermal 58/80 mm, PDF, kirim WA klik-ke-chat, DPP/PPN terpisah saat PPN aktif | ✅ | 0.27.0 |
| | Buka-tutup kas shift (modal awal, kas keluar kecil, hitung per pecahan, selisih + persetujuan, rekap non-tunai) | ✅ | 0.11.0 |
| | Piutang: rekap per pelanggan, umur 0-30/31-60/> 60, pelunasan sebagian | ✅ | 0.11.0 |
| | Retur penjualan | ✅ | 0.12.0 |
| Stok Opname | Menyeluruh, parsial, cycle count, blind count, posting | ✅ | 0.13.0 |
| Karyawan | Data karyawan, role ganda, status + riwayat, akun login, PIN, role dinamis & matriks izin, RLS | ✅ | 0.5.0 |
| | Komisi mekanik (aturan per jasa, porsi, diakui saat invoice lunas, ringkasan komisi berjalan, dibayar bersama gaji) | ✅ | 0.16.0 |
| | Penggajian: profil gaji (bulanan/harian, tunjangan), periode bulanan/mingguan, lembur, bonus, potongan, alur Draft > Review > Disetujui > Dibayar + jurnal otomatis | ✅ | 0.16.0 |
| | Kasbon: pencairan, cicilan potong gaji otomatis, pelunasan tunai | ✅ | 0.16.0 |
| | Slip gaji (cetak browser) | ✅ | 0.16.0 |
| | Slip gaji PDF, PPh 21 & BPJS otomatis, absensi digital | ⬜ | Backlog / Fase 2 |
| Finance | Kas/bank (banyak akun), pemasukan lain, pengeluaran, transfer, setoran modal & prive, biaya rutin bulanan | ✅ | 0.14.0 |
| | Foto bukti transaksi kas | ✅ | 0.28.0 |
| | Chart of accounts (tambah akun), jurnal otomatis semua modul, jurnal manual + pembalik, tutup buku bulanan | ✅ | 0.14.0 |
| | Laba rugi (banding periode lalu), neraca, arus kas, buku besar, margin per jasa/barang/WO, ekspor Excel | ✅ | 0.14.0 |
| | Ekspor PDF laporan (laba rugi, neraca, arus kas, margin) | ✅ | 0.27.0 |
| Pajak | Profil pajak (bentuk usaha, PKP, saklar PPN/PPh), tarif PPN bertanggal | ✅ | 0.15.0 |
| | Laporan PPN (Keluaran, Masukan, selisih, daftar dokumen, setoran, ekspor Excel) | ✅ | 0.15.0 |
| | PPh Final UMKM (omzet bebas OP, jurnal bulanan, peringatan 80%/95% batas, setor) & estimasi PPh tarif umum di laba rugi | ✅ | 0.15.0 |
| | Ekspor faktur pajak format DJP | ⬜ | Coming Soon |
| AI | MCP server read-only (11 tools, token pribadi), skor kesehatan 9 indikator, ringkasan mingguan, log panggilan AI | ✅ | 0.17.0 |
| | Tanya AI di aplikasi (butuh ANTHROPIC_API_KEY) | 🟨 | 0.17.0 (belum diuji dengan kunci) |
| | OAuth per pengguna untuk MCP, ambang skor bisa diatur, kirim ringkasan ke WhatsApp | ⬜ | Backlog / Fase 2 |
| Audit | Audit log: pencatatan otomatis di DB (append-only) | ✅ | 0.2.0 |
| Sistem | Layar pengaturan bengkel (diskon, retur, opname, stok minus, wajib scan part) | ✅ | 0.24.0 |
| | Pengaturan profil: foto profil, nomor HP, ganti password, PIN, tema | ✅ | 0.32.0 |
| | Pusat notifikasi: bel slide-down, banner realtime, rekam aksi semua modul, riwayat berfilter | ✅ | 0.33.0 |
| | Redesain UI/UX dari Figma, tahap 1: fondasi (token Light/Dark, Inter, komponen dasar) | ✅ | 0.34.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 2: kerangka (sidebar terang bergrup, bilah atas, drawer mobile) | ✅ | 0.35.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: Beranda dengan data nyata | ✅ | 0.36.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Kasir sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.37.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Servis & Work Order sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.38.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Barang & Jasa sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.39.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Pembelian sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.40.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Pelanggan sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.41.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Stok Opname sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.42.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Keuangan sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.43.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Penggajian sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.44.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Pajak sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.45.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Karyawan sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.46.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul AI Analyst sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.47.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Audit Log sesuai Figma (Desktop & Mobile, Light & Dark) | ✅ | 0.48.0 (cabang ui-ux-redesign) |
| | Redesain UI/UX tahap 3: modul Pop up form, Pengaturan, Notifikasi | 🟨 | menyusul, lihat catatan-redesain.md |
| | Notifikasi per peran (izin Notifikasi di matriks peran + tersaring izin modul) | ✅ | 0.33.0 |
| | Filter daftar seragam (rentang tanggal + kategori): Kasir (penjualan, retur, shift, piutang) | ✅ | 0.29.0 |
| | Filter daftar: Pembelian (PO, penerimaan, hutang), Stok opname, Servis (estimasi, riwayat), Kas & bank | ✅ | 0.30.0 |
| | Filter daftar: Penggajian, Barang, Jasa, Pelanggan, Kendaraan, Karyawan; Audit log, Garansi, Jurnal disamakan | ✅ | 0.31.0 |
| | Halaman Audit log (filter, sebelum/sesudah, panggilan AI) | ✅ | 0.18.0 |
| | Ekspor audit log ke Excel | ✅ | 0.23.0 |

## Fase 2
| Fitur | Status |
|---|---|
| Checklist & foto kondisi kendaraan | ⬜ |
| Harga jual bertingkat | ⬜ |
| Member & poin loyalitas | ⬜ |
| Booking online + WhatsApp otomatis | ⬜ |
| Absensi digital | ⬜ |

## Coming Soon
| Fitur | Status |
|---|---|
| Multi-cabang + transfer stok | ⬜ |
| Android App (Expo) | ⬜ |
| Ekspor faktur pajak DJP | ⬜ |

# Daftar Fitur Bengkel Mobil App

Status: ⬜ Belum · 🟨 Proses · ✅ Selesai · Versi saat ini: **0.15.0**

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
| | Kompatibilitas kendaraan | 🟨 | 0.6.0 (DB) |
| | Lokasi Area > Rak > Bin, stok per lokasi, pindah lokasi | ✅ | 0.6.0 |
| | QR label (cetak thermal/A4) & scan kamera/USB | ⬜ | - |
| | Konversi satuan | ✅ | 0.6.0 |
| | Foto barang | ⬜ | - |
| | Master jasa & paket servis (alokasi harga proporsional) | ✅ | 0.6.0 |
| | Mutasi stok (ledger) + HPP rata-rata tertimbang + saldo awal + peringatan stok minimum | ✅ | 0.6.0 |
| Pembelian | Supplier, PO (saran dari stok menipis), penerimaan barang (dari PO / tanpa PO), HPP rata-rata, PPN masuk HPP / PPN Masukan | ✅ | 0.7.0 |
| | Cetak / kirim PO sebagai PDF lewat WhatsApp, foto faktur | ⬜ | - |
| | Retur ke supplier, hutang usaha (aging, jatuh tempo H-3) & pembayaran (sebagian / banyak faktur, batal) | ✅ | 0.7.0 |
| Pelanggan | Pelanggan & kendaraan relasional, riwayat kepemilikan | ✅ | 0.9.0 |
| | Riwayat servis per kendaraan (tanggal, km, jasa, part, mekanik, biaya, garansi) | ✅ | 0.10.0 |
| | Reminder servis berkala (klik-ke-WA) | ⬜ | - |
| Servis | Estimasi (versi/revisi, kirim WA klik-ke-chat, persetujuan langsung/telepon/chat, masa berlaku, paket dipecah) | ✅ | 0.10.0 |
| | Work order dari estimasi (satu klik), pekerjaan tambahan wajib persetujuan, mekanik per jasa (porsi %), minta/keluar/kembali part + jurnal | ✅ | 0.10.0 |
| | Pengambilan part dengan scan QR | ⬜ | menunggu QR label |
| | Papan status kanban (lama di status, tanda merah lewat durasi, layar penuh TV, segar tiap 30 detik) | ✅ | 0.10.0 |
| | Papan realtime (Supabase Realtime) | ⬜ | - |
| | Garansi & klaim (WO garansi Rp0, biaya part ke Beban Garansi) | 🟨 | 0.10.0 (masa garansi dari tanggal diserahkan; dari invoice & laporan klaim menyusul) |
| | WO ditutup jadi invoice (wajib sebelum kendaraan diserahkan) | ✅ | 0.11.0 |
| Penjualan & Kas | POS part langsung (draft ditahan, pelanggan opsional), diskon per role + PIN Owner | ✅ | 0.11.0 |
| | POS dengan scan QR | ⬜ | menunggu QR label |
| | Pembayaran fleksibel (split tunai/transfer/QRIS/EDC, DP dipotong otomatis, tempo + batas kredit) | ✅ | 0.11.0 |
| | Nota/invoice: cetak lewat browser, kirim WA klik-ke-chat, DPP/PPN terpisah saat PPN aktif | 🟨 | 0.11.0 (thermal 58/80 mm khusus & PDF menyusul) |
| | Buka-tutup kas shift (modal awal, kas keluar kecil, hitung per pecahan, selisih + persetujuan, rekap non-tunai) | ✅ | 0.11.0 |
| | Piutang: rekap per pelanggan, umur 0-30/31-60/> 60, pelunasan sebagian | ✅ | 0.11.0 |
| | Retur penjualan | ✅ | 0.12.0 |
| Stok Opname | Menyeluruh, parsial, cycle count, blind count, posting | ✅ | 0.13.0 |
| Karyawan | Data karyawan, role ganda, status + riwayat, akun login, PIN, role dinamis & matriks izin, RLS | ✅ | 0.5.0 |
| | Komisi mekanik (aturan per jasa, porsi, diakui saat invoice lunas) | 🟨 | 0.11.0 (layar ringkasan komisi & pembayaran lewat penggajian menyusul) |
| | Penggajian sederhana & kasbon, slip gaji | ⬜ | - |
| Finance | Kas/bank (banyak akun), pemasukan lain, pengeluaran, transfer, setoran modal & prive, biaya rutin bulanan | ✅ | 0.14.0 |
| | Foto bukti transaksi | ⬜ | - |
| | Chart of accounts (tambah akun), jurnal otomatis semua modul, jurnal manual + pembalik, tutup buku bulanan | ✅ | 0.14.0 |
| | Laba rugi (banding periode lalu), neraca, arus kas, buku besar, margin per jasa/barang/WO, ekspor Excel | ✅ | 0.14.0 |
| | Ekspor PDF laporan (saat ini cetak lewat browser) | ⬜ | - |
| Pajak | Profil pajak (bentuk usaha, PKP, saklar PPN/PPh), tarif PPN bertanggal | ✅ | 0.15.0 |
| | Laporan PPN (Keluaran, Masukan, selisih, daftar dokumen, setoran, ekspor Excel) | ✅ | 0.15.0 |
| | PPh Final UMKM (omzet bebas OP, jurnal bulanan, peringatan 80%/95% batas, setor) & estimasi PPh tarif umum di laba rugi | ✅ | 0.15.0 |
| | Ekspor faktur pajak format DJP | ⬜ | Coming Soon |
| AI | MCP server read-only (11 tools), skor kesehatan, ringkasan mingguan | ⬜ | - |
| Audit | Audit log | 🟨 | 0.2.0 (DB) |

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

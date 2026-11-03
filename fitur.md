# Daftar Fitur Bengkel Mobil App

Status: ⬜ Belum · 🟨 Proses · ✅ Selesai · Versi saat ini: **0.7.1**

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
| Pelanggan | Pelanggan & kendaraan relasional, riwayat kepemilikan | ⬜ | - |
| | Riwayat servis, reminder servis (klik-ke-WA) | ⬜ | - |
| Servis | Estimasi (versi, persetujuan) | ⬜ | - |
| | Work order, pengambilan part via scan | ⬜ | - |
| | Papan status kanban (realtime, mode TV) | ⬜ | - |
| | Garansi & klaim | ⬜ | - |
| Penjualan & Kas | POS, diskon per role | ⬜ | - |
| | Pembayaran fleksibel (split, DP, tempo) | ⬜ | - |
| | Nota/invoice (thermal, A4, PDF, WA) | ⬜ | - |
| | Buka-tutup kas shift | ⬜ | - |
| | Retur penjualan, piutang | ⬜ | - |
| Stok Opname | Menyeluruh, parsial, cycle count, blind count, posting | ⬜ | - |
| Karyawan | Data karyawan, role ganda, status + riwayat, akun login, PIN, role dinamis & matriks izin, RLS | ✅ | 0.5.0 |
| | Komisi mekanik | ⬜ | - |
| | Penggajian sederhana & kasbon, slip gaji | ⬜ | - |
| Finance | Kas/bank, pemasukan/pengeluaran, biaya rutin | ⬜ | - |
| | Chart of accounts, jurnal otomatis, jurnal manual, tutup buku | 🟨 | 0.7.0 (DB: bagan akun, jurnal otomatis pembelian) |
| | Laba rugi, neraca, arus kas, buku besar, ekspor Excel/PDF | ⬜ | - |
| Pajak | Profil pajak, PPN (DPP 11/12), PPh Final UMKM, estimasi PPh umum | ⬜ | - |
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

# Daftar Fitur — Bengkel Mobil App

Status: ⬜ Belum · 🟨 Proses · ✅ Selesai — Versi saat ini: **0.4.3**

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

## MVP
| Modul | Fitur | Status | Versi |
|---|---|---|---|
| Master Data & Inventory | Barang (SKU, kategori, merek, part number, kompatibilitas) | ⬜ | – |
| | Lokasi Area > Rak > Bin, stok per lokasi | ⬜ | – |
| | QR label (cetak thermal/A4) & scan kamera/USB | ⬜ | – |
| | Konversi satuan | ⬜ | – |
| | Master jasa & paket servis (alokasi harga proporsional) | ⬜ | – |
| | Mutasi stok (ledger) + peringatan stok minimum | ⬜ | – |
| Pembelian | Supplier, PO, penerimaan barang, HPP rata-rata | ⬜ | – |
| | Retur ke supplier, hutang usaha & pembayaran | ⬜ | – |
| Pelanggan | Pelanggan & kendaraan relasional, riwayat kepemilikan | ⬜ | – |
| | Riwayat servis, reminder servis (klik-ke-WA) | ⬜ | – |
| Servis | Estimasi (versi, persetujuan) | ⬜ | – |
| | Work order, pengambilan part via scan | ⬜ | – |
| | Papan status kanban (realtime, mode TV) | ⬜ | – |
| | Garansi & klaim | ⬜ | – |
| Penjualan & Kas | POS, diskon per role | ⬜ | – |
| | Pembayaran fleksibel (split, DP, tempo) | ⬜ | – |
| | Nota/invoice (thermal, A4, PDF, WA) | ⬜ | – |
| | Buka-tutup kas shift | ⬜ | – |
| | Retur penjualan, piutang | ⬜ | – |
| Stok Opname | Menyeluruh, parsial, cycle count, blind count, posting | ⬜ | – |
| Karyawan | Data karyawan, role dinamis, matriks izin, RLS | 🟨 | 0.2.0 (DB) |
| | Komisi mekanik | ⬜ | – |
| | Penggajian sederhana & kasbon, slip gaji | ⬜ | – |
| Finance | Kas/bank, pemasukan/pengeluaran, biaya rutin | ⬜ | – |
| | Chart of accounts, jurnal otomatis, jurnal manual, tutup buku | ⬜ | – |
| | Laba rugi, neraca, arus kas, buku besar, ekspor Excel/PDF | ⬜ | – |
| Pajak | Profil pajak, PPN (DPP 11/12), PPh Final UMKM, estimasi PPh umum | ⬜ | – |
| AI | MCP server read-only (11 tools), skor kesehatan, ringkasan mingguan | ⬜ | – |
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

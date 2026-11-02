# Daftar Fitur â€” Bengkel Mobil App

Status: â¬œ Belum Â· ðŸŸ¨ Proses Â· âœ… Selesai â€” Versi saat ini: **0.1.1**

## Fondasi
| Fitur | Status | Versi |
|---|---|---|
| Supabase self-host di Coolify lokal | âœ… | 0.0.3 |
| Akses Postgres langsung (port 54322) untuk migration | âœ… | 0.0.4 |
| Setup proyek (Next.js, Tailwind, shadcn/ui, Supabase) | âœ… | 0.1.0 |
| Dockerfile standalone + endpoint `/api/v1/health` | âœ… | 0.1.0 |
| Skema dasar: branches, settings, number_sequences, audit_logs | â¬œ | â€“ |
| Auth (email + password), PIN persetujuan, auto-logout 12 jam | â¬œ | â€“ |

## MVP
| Modul | Fitur | Status | Versi |
|---|---|---|---|
| Master Data & Inventory | Barang (SKU, kategori, merek, part number, kompatibilitas) | â¬œ | â€“ |
| | Lokasi Area > Rak > Bin, stok per lokasi | â¬œ | â€“ |
| | QR label (cetak thermal/A4) & scan kamera/USB | â¬œ | â€“ |
| | Konversi satuan | â¬œ | â€“ |
| | Master jasa & paket servis (alokasi harga proporsional) | â¬œ | â€“ |
| | Mutasi stok (ledger) + peringatan stok minimum | â¬œ | â€“ |
| Pembelian | Supplier, PO, penerimaan barang, HPP rata-rata | â¬œ | â€“ |
| | Retur ke supplier, hutang usaha & pembayaran | â¬œ | â€“ |
| Pelanggan | Pelanggan & kendaraan relasional, riwayat kepemilikan | â¬œ | â€“ |
| | Riwayat servis, reminder servis (klik-ke-WA) | â¬œ | â€“ |
| Servis | Estimasi (versi, persetujuan) | â¬œ | â€“ |
| | Work order, pengambilan part via scan | â¬œ | â€“ |
| | Papan status kanban (realtime, mode TV) | â¬œ | â€“ |
| | Garansi & klaim | â¬œ | â€“ |
| Penjualan & Kas | POS, diskon per role | â¬œ | â€“ |
| | Pembayaran fleksibel (split, DP, tempo) | â¬œ | â€“ |
| | Nota/invoice (thermal, A4, PDF, WA) | â¬œ | â€“ |
| | Buka-tutup kas shift | â¬œ | â€“ |
| | Retur penjualan, piutang | â¬œ | â€“ |
| Stok Opname | Menyeluruh, parsial, cycle count, blind count, posting | â¬œ | â€“ |
| Karyawan | Data karyawan, role dinamis, matriks izin, RLS | â¬œ | â€“ |
| | Komisi mekanik | â¬œ | â€“ |
| | Penggajian sederhana & kasbon, slip gaji | â¬œ | â€“ |
| Finance | Kas/bank, pemasukan/pengeluaran, biaya rutin | â¬œ | â€“ |
| | Chart of accounts, jurnal otomatis, jurnal manual, tutup buku | â¬œ | â€“ |
| | Laba rugi, neraca, arus kas, buku besar, ekspor Excel/PDF | â¬œ | â€“ |
| Pajak | Profil pajak, PPN (DPP 11/12), PPh Final UMKM, estimasi PPh umum | â¬œ | â€“ |
| AI | MCP server read-only (11 tools), skor kesehatan, ringkasan mingguan | â¬œ | â€“ |
| Audit | Audit log | â¬œ | â€“ |

## Fase 2
| Fitur | Status |
|---|---|
| Checklist & foto kondisi kendaraan | â¬œ |
| Harga jual bertingkat | â¬œ |
| Member & poin loyalitas | â¬œ |
| Booking online + WhatsApp otomatis | â¬œ |
| Absensi digital | â¬œ |

## Coming Soon
| Fitur | Status |
|---|---|
| Multi-cabang + transfer stok | â¬œ |
| Android App (Expo) | â¬œ |
| Ekspor faktur pajak DJP | â¬œ |

# CLAUDE.md — Agent Default Proyek Bengkel Mobil App

## Peran
Kamu adalah **Programmer Fullstack Developer senior** yang teliti dan berpengalaman (Next.js, TypeScript, PostgreSQL/Supabase).
Setiap instruksi user (coding, fitur baru, bugfix, refactor, dokumentasi) dikerjakan sampai tuntas, diverifikasi, dan dicatat.

Sumber kebenaran kebutuhan produk: `PRD Bengkel Mobil App.docx` (PRD, 2 Nov 2026). Jika instruksi bertentangan dengan PRD, tanyakan dulu ke user.

## Ringkasan Produk (dari PRD)
Web app untuk satu bengkel mobil kecil: jasa servis + sparepart. Modul MVP:
master data & inventory (QR, konversi satuan, paket), pembelian/supplier/hutang, pelanggan & kendaraan,
estimasi/work order/papan status/garansi, POS/pembayaran/kas shift/retur/piutang, stok opname,
karyawan/role/RLS/komisi/penggajian, finance & jurnal otomatis, pajak PPN & PPh Final (ON/OFF),
AI Business Analyst via MCP (read-only), audit log.
Fase 2 / Coming Soon: booking online, WA otomatis, member, multi-cabang, Android (Expo).

## Tech Stack (wajib, sesuai PRD §19)
- Next.js App Router + TypeScript + Tailwind + shadcn/ui
- React Hook Form + Zod (skema dipakai ulang di server)
- TanStack Table, Recharts; qrcode + html5-qrcode/@zxing/browser; exceljs
- Supabase: PostgreSQL, Auth, Storage (S3-compatible), Realtime, pg_cron
- MCP server: TypeScript MCP SDK, HTTP transport, OAuth per user
- Hosting: Docker di Coolify untuk semua environment. **Jangan** pakai fitur khusus vendor (Netlify/Vercel).

## Environment (menggantikan PRD §19.2)
| Lingkungan | Aplikasi | Database |
|---|---|---|
| Development | Docker + **Coolify lokal** (mesin developer) | Supabase self-host di Coolify lokal |
| Staging | Coolify di VPS | Supabase self-host di Coolify |
| Production | Coolify di VPS (8 GB RAM) | Supabase self-host + backup harian off-site |

Konsekuensi: aplikasi wajib punya `Dockerfile` (Next.js `output: "standalone"`), semua config via env
(`.env.example` selalu diperbarui), dan migration SQL dijalankan dengan Supabase CLI ke instance lokal.
Karena dev sudah self-host, migrasi ke production cukup pindah ke VPS dengan stack yang sama.

## Aturan Teknis Wajib
1. **Ledger, bukan edit.** Stok = jumlah `stock_movements`; uang = `journal_lines`. Tidak ada edit diam-diam.
2. **Tidak ada hapus permanen.** Dokumen: status `draft | posted | void` + `void_reason`. Master: nonaktifkan.
3. **Konvensi tabel:** PK `id uuid`; kolom `branch_id, created_at, created_by, updated_at`; nama tabel/kolom Inggris snake_case; label UI Bahasa Indonesia.
4. **Tipe data:** uang `numeric(18,2)`, jumlah `numeric(14,3)`. **Dilarang float.**
5. **Logika inti di database** (function/trigger PostgreSQL): stok, HPP rata-rata tertimbang, jurnal, pajak, komisi. Bukan di Edge Functions / halaman.
6. **Skema hanya lewat file migration SQL** di Git (`supabase/migrations/`), tidak klik dashboard.
7. **RLS di semua tabel bisnis**, policy memanggil helper `app.current_employee_id()`.
8. **Tarif pajak dari tabel bertanggal** (`tax_rates.valid_from/valid_to`), tidak di-hardcode.
9. **Transaksi atomik:** stok + jurnal + pembayaran dalam satu DB transaction.
10. **Audit log** untuk buat/ubah/batal transaksi, harga, stok, role, setting pajak, panggilan AI.
11. Secret hanya di env server; semua konfigurasi via environment variable.
12. API berversi `/api/v1` (persiapan Android). Zona waktu Asia/Jakarta, format Rupiah & tanggal Indonesia.

## Cara Kerja
1. Pahami instruksi + bagian PRD terkait sebelum menulis kode.
2. Kerjakan dengan kode yang rapi, konsisten dengan kode sekitar, dan tervalidasi (lint/typecheck/test bila ada).
3. Laporkan hasil apa adanya — jika test gagal atau ada yang belum diverifikasi, sebutkan.

## Wajib Setelah Setiap Perubahan Kode
1. **Naikkan versi** (SemVer, mulai `0.0.1`):
   - patch `0.0.x` → bugfix / perubahan kecil / dokumentasi
   - minor `0.x.0` → fitur/modul baru
   - major `x.0.0` → rilis besar / go-live
   Simpan versi di `VERSION` (dan `package.json` bila sudah ada).
2. **Update `devlog.md`** — entri baru paling atas: versi, tanggal (YYYY-MM-DD), ringkasan, daftar perubahan (Added/Changed/Fixed/Removed), file terdampak.
3. **Update `fitur.md`** — ubah status fitur (⬜ Belum · 🟨 Proses · ✅ Selesai) dan tambahkan fitur baru bila ada.
4. **Commit ke git** dengan pesan: `Update ver X.Y.Z: <ringkasan singkat>` lalu buat tag `vX.Y.Z`.
   Push ke remote hanya jika remote sudah dikonfigurasi dan user mengizinkan.

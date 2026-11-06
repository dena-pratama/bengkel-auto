# AutoMobi: Aplikasi Bengkel Mobil

Web app untuk mengelola **satu bengkel mobil kecil** yang menjual jasa servis dan sparepart. Semua alur harian ada di satu tempat: penerimaan kendaraan, estimasi, work order, papan status, kasir, stok gudang, pembelian ke supplier, keuangan dengan jurnal otomatis, pajak, karyawan dan penggajian, sampai analis bisnis berbasis AI.

| | |
|---|---|
| Versi | **0.55.1** (lihat [`VERSION`](VERSION) dan [`devlog.md`](devlog.md)) |
| Status | MVP selesai; redesain UI/UX dari Figma sedang berjalan di cabang `ui-ux-redesign` |
| Sumber kebutuhan | `PRD Bengkel Mobil App.docx` (PRD, 2 Nov 2026) |
| Bahasa antarmuka | Bahasa Indonesia, format Rupiah dan tanggal Indonesia, zona waktu Asia/Jakarta |
| Repositori | `github.com/dena-pratama/bengkel-auto` (privat) |

---

## Daftar isi

1. [Fitur](#fitur)
2. [Peran dan hak akses](#peran-dan-hak-akses)
3. [Tech stack](#tech-stack)
4. [Prinsip arsitektur](#prinsip-arsitektur)
5. [Struktur folder](#struktur-folder)
6. [Lingkungan (environment)](#lingkungan-environment)
7. [Menjalankan di lokal](#menjalankan-di-lokal)
8. [Variabel environment](#variabel-environment)
9. [Database dan migrasi](#database-dan-migrasi)
10. [API v1](#api-v1)
11. [AI Analyst dan server MCP](#ai-analyst-dan-server-mcp)
12. [Pengujian dan kualitas kode](#pengujian-dan-kualitas-kode)
13. [Deploy (Docker + Coolify)](#deploy-docker--coolify)
14. [Pratinjau UI tanpa login](#pratinjau-ui-tanpa-login)
15. [Konvensi pengembangan](#konvensi-pengembangan)
16. [Pemecahan masalah](#pemecahan-masalah)
17. [Roadmap](#roadmap)
18. [Dokumen terkait](#dokumen-terkait)

---

## Fitur

Status lengkap per fitur ada di [`fitur.md`](fitur.md). Ringkasan per modul:

### Beranda
- Kartu angka dari data nyata: work order aktif dan yang melewati estimasi, omzet bulan ini, piutang pelanggan, barang menipis.
- Daftar work order aktif, notifikasi terbaru, beban kerja per mekanik, barang menipis, kas shift yang sedang dibuka.
- Aksi cepat dalam bentuk pop up isian langsung (data dimuat saat dibutuhkan).
- Setiap blok tersaring hak akses peran; satu blok yang gagal tidak merusak halaman.

### Master data dan inventory (`/inventory`)
- Barang: SKU otomatis, kategori 2 tingkat, merek, part number OEM dan alternatif, garansi, flag PPN, foto barang.
- Kompatibilitas kendaraan per barang, bisa dicari dari nama kendaraan.
- Lokasi bertingkat **Area > Rak > Bin**, stok per lokasi, pindah lokasi.
- Konversi satuan, master jasa, dan paket servis (harga dialokasikan proporsional ke komponennya).
- **Stok sebagai ledger** (`stock_movements`), HPP rata-rata tertimbang, saldo awal, peringatan stok minimum.
- Label QR barang dan rak (thermal 30x20 / 50x30 mm atau A4), scan QR lewat kamera atau scanner USB.

### Pembelian (`/pembelian`)
- Supplier, purchase order (saran dari stok menipis), PO sebagai PDF untuk dikirim manual lewat WhatsApp.
- Penerimaan barang dari PO atau tanpa PO, PPN masuk HPP atau sebagai PPN Masukan, foto faktur supplier.
- Retur ke supplier, hutang usaha dengan umur dan pengingat jatuh tempo H-3, pembayaran sebagian atau banyak faktur sekaligus, pembatalan pembayaran.

### Pelanggan dan kendaraan (`/pelanggan`)
- Pelanggan dan kendaraan relasional, riwayat kepemilikan (pindah tangan kendaraan).
- Riwayat servis per kendaraan: tanggal, km, jasa, part, mekanik, biaya, garansi.
- Reminder servis berkala berdasarkan aturan km atau bulan per jasa, dengan tombol klik-ke-WhatsApp.

### Servis dan work order (`/servis`)
- Estimasi dengan versi/revisi, kirim lewat klik-ke-chat WhatsApp, persetujuan langsung/telepon/chat, masa berlaku.
- Work order dari estimasi dengan satu klik; pekerjaan tambahan wajib disetujui pelanggan.
- Mekanik per jasa dengan porsi persen (dasar komisi).
- Minta, keluarkan, dan kembalikan part dengan jurnal otomatis; opsi wajib scan QR barang dan rak saat mengambil part.
- **Papan status kanban realtime** (Supabase Realtime, cadangan polling 30 detik), mode layar penuh untuk TV, tanda merah bila lewat durasi.
- Garansi dan klaim: WO garansi Rp0, biaya part masuk Beban Garansi, masa garansi dihitung dari tanggal invoice; laporan klaim per mekanik, barang, supplier.
- WO wajib ditutup menjadi invoice sebelum kendaraan diserahkan.

### Kasir dan penjualan (`/kasir`)
- POS part langsung (draft bisa ditahan, pelanggan opsional), dengan scan QR.
- Diskon dibatasi per peran; di atas batas perlu PIN persetujuan.
- Pembayaran fleksibel: split tunai/transfer/QRIS/EDC, DP dipotong otomatis, tempo dengan batas kredit.
- Nota: cetak A4, thermal 58/80 mm, PDF, kirim lewat klik-ke-chat WhatsApp; DPP dan PPN dipisah saat PPN aktif.
- Buka/tutup kas shift: modal awal, kas keluar kecil, hitung per pecahan, selisih dan persetujuan, rekap non-tunai.
- Piutang per pelanggan dengan umur 0-30 / 31-60 / lebih dari 60 hari, pelunasan sebagian.
- Retur penjualan.

### Stok opname (`/stok-opname`)
- Menyeluruh, parsial, cycle count, blind count; hitung ulang, persetujuan, dan posting selisih ke ledger.

### Keuangan (`/keuangan`)
- Kas dan bank (banyak akun), pemasukan lain, pengeluaran, transfer, setoran modal dan prive, biaya rutin bulanan, foto bukti transaksi.
- Chart of accounts, **jurnal otomatis dari semua modul**, jurnal manual dan jurnal pembalik, tutup buku bulanan.
- Laporan: laba rugi (banding periode lalu), neraca, arus kas, buku besar, margin per jasa/barang/WO. Ekspor Excel dan PDF.

### Pajak (`/pajak`)
- Profil pajak (bentuk usaha, PKP, saklar PPN dan PPh), **tarif PPN dari tabel bertanggal** (tidak di-hardcode).
- Laporan PPN: Keluaran, Masukan, selisih, daftar dokumen, setoran, ekspor Excel.
- PPh Final UMKM: omzet bebas untuk orang pribadi, jurnal bulanan, peringatan 80% dan 95% batas omzet, setoran. Estimasi PPh tarif umum di laba rugi.

### Karyawan dan penggajian (`/karyawan`, `/penggajian`)
- Data karyawan, peran ganda, status dan riwayatnya, akun login, PIN persetujuan, peran dinamis dengan matriks izin.
- Komisi mekanik per jasa sesuai porsi, diakui saat invoice lunas, dibayar bersama gaji.
- Penggajian bulanan atau harian (tunjangan, lembur, bonus, potongan), periode bulanan/mingguan, alur Draft > Review > Disetujui > Dibayar dengan jurnal otomatis, slip gaji.
- Kasbon: pencairan, cicilan potong gaji otomatis, pelunasan tunai.

### AI Analyst (`/ai`)
- Skor kesehatan bisnis 9 indikator dan ringkasan mingguan.
- **Tanya AI** di dalam aplikasi dengan pilihan penyedia: Anthropic (Claude), OpenAI (GPT), Google Gemini, OpenRouter.
- **Server MCP read-only** dengan 11 tool dan token pribadi, untuk dihubungkan ke klien AI eksternal.
- Log setiap panggilan AI. Detail ada di [AI Analyst dan server MCP](#ai-analyst-dan-server-mcp).

### Audit, notifikasi, dan pengaturan
- **Audit log append-only** di database untuk perubahan transaksi, harga, stok, peran, setting pajak, dan panggilan AI; halaman audit dengan filter, data sebelum/sesudah, ekspor Excel.
- Pusat notifikasi: bel slide-down, banner realtime, riwayat berfilter, izin notifikasi per peran.
- Pengaturan bengkel (batas diskon, batas hari retur, ambang opname, stok minus, wajib scan part, penyedia dan model Tanya AI) dan pengaturan profil (foto, nomor HP, ganti password, PIN, tema).
- Filter daftar seragam (rentang tanggal dan kategori) di semua modul yang punya daftar.
- Mode terang dan gelap, tata letak responsif desktop dan mobile.

### Halaman masuk
- Login bergaya "start mesin": tachometer beranimasi dan tombol ENGINE START STOP, lalu kartu login.
- Auto-logout setelah 12 jam tidak aktif. Setup Owner pertama lewat `/setup` saat database masih kosong.

---

## Peran dan hak akses

Lima peran bawaan (bisa ditambah dan diubah di **Karyawan > Peran**):

| Kode | Nama | Cakupan default |
|---|---|---|
| `owner` | Owner | Superuser, semua akses termasuk modul baru |
| `admin` | Admin / Service Advisor | Pelanggan, estimasi, work order, master data |
| `cashier` | Kasir | Penjualan, pembayaran, kas harian |
| `mechanic` | Mekanik | Work order miliknya, status pekerjaan, komisi sendiri |
| `warehouse` | Gudang | Penerimaan barang, pengeluaran part, stok opname |

- Izin = **27 modul x 6 aksi** (`view`, `create`, `update`, `void`, `approve`, `export`) dengan cakupan `all` atau `own`.
- **RLS aktif di semua tabel bisnis.** Policy memanggil helper `app.current_employee_id()`, `app.current_branch_id()`, dan `app.has_permission(module, action)`. Pemeriksaan izin di aplikasi hanya untuk menyembunyikan menu; penegakan sebenarnya di database.
- Tindakan sensitif (diskon di atas batas, batal transaksi, melebihi batas kredit, selisih opname besar, retur lewat batas hari) memerlukan **PIN persetujuan** (bcrypt, tercatat di audit log).
- Karyawan berstatus Nonaktif otomatis tidak bisa login.

---

## Tech stack

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `cacheComponents`, output `standalone`), React 19, TypeScript 5 |
| UI | Tailwind CSS 4, komponen gaya shadcn/ui di atas Base UI, lucide-react, Motion, Sonner (toast), font Inter dan Geist Mono |
| Form dan validasi | React Hook Form + Zod 4 (skema dipakai ulang di server action) |
| Tabel | TanStack Table |
| Dokumen | pdf-lib (PDF nota, PO, laporan), exceljs (ekspor Excel), qrcode + html5-qrcode (label dan scan QR) |
| Backend | Supabase self-host: PostgreSQL, Auth, Storage (bucket privat `attachments`), Realtime |
| AI | Server MCP (JSON-RPC lewat HTTP, token pribadi), Tanya AI multi penyedia |
| Hosting | Docker di Coolify untuk semua environment (tanpa fitur khusus Vercel/Netlify) |
| CI | GitHub Actions: cek tanda pisah, lint, build, uji Playwright lewat Browserless |
| Runtime | Node.js 24 |

---

## Prinsip arsitektur

Aturan ini wajib dan berlaku di semua modul (lihat juga [`CLAUDE.md`](CLAUDE.md)):

1. **Ledger, bukan edit.** Stok = jumlah `stock_movements`; uang = `journal_lines`. Tidak ada perubahan saldo diam-diam.
2. **Tidak ada hapus permanen.** Dokumen memakai status `draft | posted | void` dengan `void_reason`; data master dinonaktifkan.
3. **Logika inti di database.** Stok, HPP rata-rata tertimbang, jurnal, pajak, dan komisi dihitung oleh fungsi dan trigger PostgreSQL (`security definer`, `search_path` kosong). Halaman hanya memanggil RPC.
4. **Transaksi atomik.** Stok, jurnal, dan pembayaran dalam satu transaksi database.
5. **Tipe data uang dan jumlah.** Uang `numeric(18,2)`, jumlah `numeric(14,3)`. Float dilarang.
6. **Konvensi tabel.** PK `id uuid`; kolom `branch_id, created_at, created_by, updated_at`; nama tabel dan kolom bahasa Inggris snake_case; label UI bahasa Indonesia.
7. **Skema hanya lewat migrasi SQL** di `supabase/migrations/`, tidak lewat klik dashboard.
8. **Penomoran dokumen atomik** lewat `app.next_document_number()`, format `PREFIX-YYMM-0001` (contoh `INV-2611-0001`).
9. **Audit log append-only.** Tabel `audit_logs` tidak bisa diubah, dihapus, atau di-truncate.
10. **Secret hanya di environment server.** Kunci API (Supabase service role, penyedia AI) tidak pernah disimpan di database atau dikirim ke browser.
11. **API berversi** di `/api/v1` sebagai persiapan aplikasi Android.

---

## Struktur folder

```
bengkel-app/
├── src/
│   ├── app/
│   │   ├── (auth)/              # /login (start mesin) dan /setup (Owner pertama)
│   │   ├── (app)/               # Semua halaman setelah login (pakai kerangka sidebar + bilah atas)
│   │   │   ├── dashboard/       # Beranda
│   │   │   ├── servis/          # Estimasi, work order, papan status, garansi
│   │   │   ├── kasir/           # POS, penjualan, retur, shift, piutang
│   │   │   ├── inventory/       # Barang, jasa, paket, master, label QR, scan
│   │   │   ├── pembelian/       # Supplier, PO, penerimaan, hutang
│   │   │   ├── pelanggan/       # Pelanggan, kendaraan, reminder servis
│   │   │   ├── stok-opname/
│   │   │   ├── keuangan/        # Kas & bank, akun, jurnal, laporan
│   │   │   ├── pajak/           # Profil pajak, PPN, PPh
│   │   │   ├── penggajian/      # Periode gaji, profil gaji, komisi, kasbon, slip
│   │   │   ├── karyawan/        # Karyawan dan peran
│   │   │   ├── ai/              # AI Analyst
│   │   │   ├── audit/           # Audit log
│   │   │   ├── notifikasi/
│   │   │   └── pengaturan/      # Profil saya dan pengaturan bengkel
│   │   ├── api/v1/              # Route handler API berversi (lihat bagian API v1)
│   │   └── dev/preview/         # Pratinjau UI tanpa login, hanya development
│   ├── components/              # Komponen bersama (kerangka, form, filter, QR, tachometer, ui/)
│   ├── lib/
│   │   ├── ai/                  # Tool AI, penyedia, Tanya AI, ringkasan mingguan
│   │   ├── supabase/            # Klien browser, server, dan admin (service role)
│   │   ├── validation/          # Skema Zod per modul
│   │   └── *.ts                 # Pembaca data per modul (server-only)
│   └── proxy.ts                 # Refresh sesi, auto-logout 12 jam, proteksi rute
├── supabase/
│   ├── migrations/              # Skema, fungsi, RLS, seed (urut berdasarkan nama file)
│   └── tests/                   # Tes SQL per modul (berjalan dalam transaksi + rollback)
├── scripts/                     # test-db, cek tanda pisah, uji Playwright/performa, pembuat logo
├── public/brand/                # Logo AutoMobi (terang, gelap, ikon)
├── design/                      # Sumber logo
├── .github/workflows/ci.yml
├── Dockerfile
├── VERSION · devlog.md · fitur.md · cek-halaman.md · CLAUDE.md
```

---

## Lingkungan (environment)

| Lingkungan | Aplikasi | Database |
|---|---|---|
| Development | `npm run dev` di mesin developer, atau Docker di **Coolify lokal** | Supabase self-host di Coolify lokal |
| Staging | Coolify di VPS | Supabase self-host di Coolify |
| Production | Coolify di VPS (8 GB RAM) | Supabase self-host + backup harian off-site |

Karena development sudah memakai stack yang sama (self-host), pindah ke production cukup memindahkan ke VPS.

---

## Menjalankan di lokal

### Prasyarat
- **Node.js 24** dan npm.
- **Docker Desktop** yang menjalankan **Coolify lokal** dengan servis **Supabase** (API lewat Kong di `http://supabase.localhost`).
- Port Postgres Supabase dipublikasikan di `127.0.0.1:54322` (Coolify > supabase-db > *Make it publicly available*) untuk migrasi dan tes.

### Langkah

```bash
git clone https://github.com/dena-pratama/bengkel-auto.git
```

```bash
cd bengkel-auto && npm install
```

```bash
cp .env.example .env.local
```

Isi `.env.local` (lihat [Variabel environment](#variabel-environment)), lalu jalankan migrasi ke Supabase lokal:

```bash
npx supabase db push --db-url "postgresql://postgres:<PASSWORD>@127.0.0.1:54322/postgres"
```

Jalankan aplikasi:

```bash
npm run dev
```

Buka `http://localhost:3000`. Saat database masih kosong, aplikasi mengarahkan ke **`/setup`** untuk membuat akun Owner pertama. Setelah itu masuk lewat `/login`.

---

## Variabel environment

Semua konfigurasi lewat environment; [`.env.example`](.env.example) selalu diperbarui. Jangan commit `.env.local`.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ya | URL Supabase (lokal: `http://supabase.localhost`). Di-inline saat build. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya | Anon key Supabase. Di-inline saat build. |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | Service role key. **Hanya server.** Dipakai untuk setup Owner, MCP, dan penjadwal. |
| `SUPABASE_INTERNAL_URL` | Saat di container | URL Supabase dari dalam jaringan Coolify (mis. `http://supabase-kong:8000`). Kosongkan saat `npm run dev` di host. |
| `DATABASE_URL` | Untuk migrasi/tes | Koneksi Postgres langsung (port 54322). |
| `TZ` | Disarankan | `Asia/Jakarta`. |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Opsional | Penyedia Anthropic untuk Tanya AI. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Opsional | Penyedia OpenAI. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Opsional | Penyedia Google Gemini. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Opsional | Penyedia OpenRouter. |

Kunci penyedia AI cukup diisi salah satu. Penyedia tanpa kunci tidak tampil. Penyedia default dan nama model bisa diubah di **Pengaturan > Bengkel > Tanya AI** tanpa mengubah environment (urutan prioritas: Pengaturan, lalu `*_MODEL`, lalu bawaan).

---

## Database dan migrasi

Semua skema, fungsi, policy RLS, dan seed ada di `supabase/migrations/` dan dijalankan berurutan:

| Migrasi | Isi |
|---|---|
| `001_foundation_system` | Schema `app`, cabang, setting, penomoran dokumen, audit log append-only |
| `002_access_control` | Karyawan, profil, peran, izin, helper RLS, PIN persetujuan |
| `003_seed_roles_permissions` | Cabang `PST` (Bengkel Pusat), 27 modul x 6 aksi, 5 peran bawaan, matriks izin default |
| `004_auth_bootstrap` | `needs_setup`, `bootstrap_owner`, `my_context` |
| `005_employee_management` | Kelola karyawan, akun, status, peran, PIN |
| `006_master_data` | Barang, kategori, merek, satuan, lokasi, jasa, paket |
| `007_stock_ledger` | Mutasi stok, saldo per lokasi, HPP, saldo awal, pindah stok, `v_low_stock` |
| `008_price_change_guard` | Penjagaan perubahan harga jual |
| `009_accounting_core` | Akun, jurnal, posting otomatis |
| `010_purchasing` | Supplier, PO, penerimaan, retur, hutang, pembayaran |
| `011_remove_long_dashes` | Pembersihan teks |
| `012_customers_vehicles` | Pelanggan, kendaraan, pindah kepemilikan |
| `013_service_orders` | Estimasi, work order, mekanik, part, garansi |
| `014_cashier` | Penjualan, pembayaran, invoice WO, shift kas, DP |
| `015_sales_returns` | Retur penjualan |
| `016_stock_opname` | Stok opname |
| `017_finance` | Kas/bank, jurnal manual, tutup buku, laporan keuangan |
| `018_tax` | Profil pajak, tarif bertanggal, PPN, PPh Final |
| `019_payroll` | Profil gaji, periode, slip, kasbon, komisi |
| `020_ai_analyst` | Token AI, `ai_run_tool`, ringkasan, log panggilan |
| `021_hide_cost_columns` | Sembunyikan kolom HPP dari peran tanpa izin |
| `022_audit_view` | View audit log |
| `023_part_issue_scan` | Pengambilan part dengan scan QR |
| `024_realtime_board` | Publikasi Realtime untuk papan servis |
| `025_warranty_invoice_date` | Garansi dihitung dari tanggal invoice, laporan klaim |
| `026_save_settings` | RPC pengaturan bengkel |
| `027_service_reminders` | Aturan dan daftar reminder servis |
| `028_item_compatibility` | Kompatibilitas barang dan kendaraan |
| `029_attachments` | Bucket privat `attachments` (maks 5 MB; JPEG, PNG, WebP, PDF) |
| `030_profile_avatar` | Foto profil dan pembaruan profil sendiri |
| `031_notifications` | Pusat notifikasi + Realtime |
| `032_ai_provider_settings` | Pengaturan penyedia dan model Tanya AI |

(Nama file lengkap diawali tanggal, misalnya `20261103000001_foundation_system.sql`.)

**Menambah perubahan skema:** buat file baru `supabase/migrations/<YYYYMMDDHHMMSS>_<nama>.sql`, jangan mengubah migrasi lama yang sudah dijalankan. Tambahkan tes SQL di `supabase/tests/` bila menyentuh logika bisnis.

---

## API v1

Semua route berada di `src/app/api/v1/`. Kecuali disebut lain, route memakai sesi login dan tunduk pada RLS.

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/v1/health` | Health check (dipakai `HEALTHCHECK` Docker). Publik. |
| POST | `/api/v1/mcp` | Server MCP AI Analyst (JSON-RPC). Auth `Bearer abk_...`. GET dibalas 405. |
| POST | `/api/v1/ai/weekly` | Buat dan simpan ringkasan mingguan. Auth `Bearer abk_...`, untuk penjadwal. |
| GET, POST | `/api/v1/attachments` | Daftar dan unggah lampiran (foto barang, faktur, bukti kas). |
| GET, DELETE | `/api/v1/attachments/[id]` | URL bertanda tangan untuk melihat, atau lepas lampiran. |
| GET | `/api/v1/kasir/penjualan/[id]/pdf` | Nota/invoice PDF. |
| GET | `/api/v1/pembelian/po/[id]/pdf` | Purchase order PDF. |
| GET | `/api/v1/keuangan/pdf` | Laporan keuangan PDF. |
| GET | `/api/v1/keuangan/export` | Laporan keuangan Excel. |
| GET | `/api/v1/audit/export` | Ekspor audit log Excel. |
| GET | `/api/v1/notifications` | Notifikasi pengguna. |
| POST | `/api/v1/notifications/read` | Tandai notifikasi sudah dibaca. |

---

## AI Analyst dan server MCP

AI **hanya bisa membaca** lewat tool yang sudah ditentukan; tidak ada query bebas. Setiap tool dijalankan oleh fungsi database (`ai_run_tool`) dengan hak akses pengguna pemilik token, dan setiap panggilan tercatat.

### Tool yang tersedia (11)
`get_business_summary`, `get_health_score`, `get_sales_trend`, `get_stock_alerts`, `get_top_items`, `get_mechanic_performance`, `get_cash_position`, `get_receivables_payables`, `get_tax_summary`, `get_service_due_customers`, `get_inventory_accuracy`.

### Menghubungkan klien AI lewat MCP
1. Buka **AI Analyst**, panel **Koneksi Claude (MCP)**, lalu buat token pribadi (format `abk_` + 48 karakter heksadesimal). Token hanya tampil sekali.
2. Daftarkan server MCP HTTP di klien AI dengan URL `https://<domain>/api/v1/mcp` dan header `Authorization: Bearer abk_...`.
3. Token bisa dicabut kapan saja dari halaman yang sama.

Protokol MCP yang didukung: `2025-06-18`, `2025-03-26`, `2024-11-05`.

### Tanya AI di aplikasi
Kotak Tanya AI memakai tool yang sama dengan server MCP, melalui penyedia pilihan: Anthropic (Messages API), OpenAI dan OpenRouter (Chat Completions, format kompatibel OpenAI), atau Google Gemini (generateContent). Kunci di environment server; penyedia default dan model di Pengaturan.

### Ringkasan mingguan otomatis
Jadwalkan (mis. Coolify scheduled task setiap Senin pagi):

```bash
curl -X POST -H "Authorization: Bearer abk_..." https://<domain>/api/v1/ai/weekly
```

---

## Pengujian dan kualitas kode

| Perintah | Fungsi |
|---|---|
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Pemeriksaan tipe TypeScript |
| `npm run check:dashes` | Memastikan tidak ada tanda pisah panjang (em dash / en dash) di file yang di-track git |
| `npm run build` | Build produksi Next.js |
| `npm run test:db` | Menjalankan semua tes SQL di `supabase/tests/` terhadap `DATABASE_URL` (psql lewat image Docker `postgres:15-alpine`). Tes berjalan dalam transaksi + rollback, tidak meninggalkan data. |
| `npm run test:e2e` | Uji koneksi Playwright ke Browserless (`PLAYWRIGHT_SERVICE_URL`, bawaan `ws://localhost:3003`) |
| `npm run test:perf` | Audit performa halaman lewat Chrome DevTools Protocol (Browserless di `localhost:3003`) |

Tes database mencakup 19 suite: ai_analyst, attachments, audit_view, cashier, compat, customers, employee_management, finance, foundation, hide_cost, inventory, notifications, payroll, purchasing, sales_returns, service_orders, settings, stock_opname, tax.

**CI (GitHub Actions, `.github/workflows/ci.yml`)** berjalan pada push dan pull request ke `main` dan `ui-ux-redesign`: cek tanda pisah, lint, build produksi, lalu uji Playwright dengan servis Browserless.

Daftar cek manual halaman setelah login (alur utama, keuangan, notifikasi, filter, hak akses per peran) ada di [`cek-halaman.md`](cek-halaman.md).

---

## Deploy (Docker + Coolify)

`Dockerfile` membangun image Next.js `standalone` tiga tahap di atas `node:24-alpine`, berjalan sebagai user non-root, zona waktu Asia/Jakarta, port 3000, dengan `HEALTHCHECK` ke `/api/v1/health`.

Variabel `NEXT_PUBLIC_*` di-inline saat build, jadi wajib dikirim sebagai build argument:

```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.com --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key> -t automobi .
```

Di Coolify:
1. Buat aplikasi dari repositori dengan build pack **Dockerfile**.
2. Isi build argument `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Isi environment runtime: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_INTERNAL_URL` (Kong di jaringan yang sama), `TZ`, dan kunci penyedia AI bila dipakai.
4. Jalankan migrasi ke database tujuan dengan `npx supabase db push --db-url ...` sebelum rilis.
5. Opsional: scheduled task mingguan ke `/api/v1/ai/weekly`.

---

## Pratinjau UI tanpa login

Saat `NODE_ENV=development`, halaman di `/dev/preview/*` menampilkan tampilan modul dengan **data contoh** tanpa perlu login (Beranda di `/dev/preview`, lalu `/dev/preview/kasir`, `/dev/preview/servis`, `/dev/preview/inventory`, `/dev/preview/fondasi`, dan lainnya). Di production semua halaman ini mengembalikan 404 dan tidak masuk daftar rute publik.

---

## Konvensi pengembangan

Setiap perubahan kode wajib:
1. **Naikkan versi** (SemVer) di `VERSION` dan `package.json`: patch untuk perbaikan kecil dan dokumentasi, minor untuk fitur/modul baru, major untuk rilis besar.
2. **Tambah entri di `devlog.md`** (paling atas): versi, tanggal, ringkasan, Added/Changed/Fixed/Removed, file terdampak.
3. **Perbarui status di `fitur.md`** (⬜ Belum, 🟨 Proses, ✅ Selesai).
4. **Commit** dengan pesan `Update ver X.Y.Z: <ringkasan>` dan buat tag `vX.Y.Z`.

Aturan tambahan:
- Tidak ada tanda pisah panjang (em dash, en dash) di teks UI, pesan error, kode, komentar, SQL, maupun dokumen. Pakai titik dua, koma, atau tanda minus biasa.
- Label UI berbahasa Indonesia; nama tabel, kolom, dan kode berbahasa Inggris.
- Validasi dengan `tsc`, `eslint`, dan `next build` sebelum commit.

---

## Pemecahan masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Aplikasi tidak bisa terhubung ke database / `supabase.localhost` tidak merespons | Docker Desktop mati. Nyalakan Docker Desktop, lalu pastikan container `supabase-db`, `supabase-kong`, `supabase-supavisor`, `coolify`, dan `coolify-proxy` berjalan (`docker start <nama>`). |
| `supabase.localhost` mengembalikan 503 | Proxy Coolify belum siap atau domain Kong salah. Jalankan `docker restart coolify-proxy`; pastikan domain Kong di Coolify adalah `supabase.localhost` port 8000. |
| Migrasi/tes gagal "connection refused" di port 54322 | Port Postgres belum dipublikasikan atau proxy belum hidup. Aktifkan *Make it publicly available* di supabase-db, atau jalankan SQL langsung di container: `docker exec -i <supabase-db> psql -U postgres -d postgres < file.sql`. |
| Perubahan kode tidak muncul / galat ekspor setelah ganti nama | Cache Turbopack basi. Hentikan dev server, hapus folder `.next`, jalankan ulang `npm run dev`. |
| Dev server bermasalah setelah `next build` | Build menimpa `.next`. Hapus `.next` lalu jalankan ulang `npm run dev`. |
| Huruf rusak di `devlog.md` / `fitur.md` | Jangan edit dengan `Set-Content` PowerShell 5.1 (bukan UTF-8). Pakai editor atau Node.js. |
| Tanya AI berkata "belum aktif" | Belum ada kunci penyedia di environment server. Isi salah satu `*_API_KEY` lalu jalankan ulang server. |

---

## Roadmap

**Fase 2**
- Checklist dan foto kondisi kendaraan
- Harga jual bertingkat
- Member dan poin loyalitas
- Booking online + WhatsApp otomatis
- Absensi digital, slip gaji PDF, PPh 21 dan BPJS otomatis
- OAuth per pengguna untuk MCP, ambang skor kesehatan bisa diatur, kirim ringkasan ke WhatsApp

**Coming soon**
- Multi-cabang + transfer stok
- Aplikasi Android (Expo)
- Ekspor faktur pajak format DJP

**Sedang berjalan:** redesain UI/UX dari Figma di cabang `ui-ux-redesign`. Tampilan sebelum redesain tersimpan di cabang dan tag `ui-ux-base`.

---

## Dokumen terkait

| Dokumen | Isi |
|---|---|
| `PRD Bengkel Mobil App.docx` | Kebutuhan produk (sumber kebenaran) |
| [`fitur.md`](fitur.md) | Daftar fitur dan statusnya per versi |
| [`devlog.md`](devlog.md) | Catatan perubahan lengkap per versi |
| [`cek-halaman.md`](cek-halaman.md) | Daftar cek manual setelah login |
| [`CLAUDE.md`](CLAUDE.md) | Aturan teknis dan cara kerja proyek |
| [`.env.example`](.env.example) | Contoh variabel environment |

---

Repositori privat. Hak cipta milik pemilik proyek; belum ada lisensi publik.

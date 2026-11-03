# Devlog — Bengkel Mobil App

Catatan setiap perubahan. Entri terbaru di paling atas.

---

## [0.4.0] — 2026-11-03
**Ringkasan:** Dark mode + toggle di top bar; profil, pengaturan, dan keluar dipindah ke top bar.

### Added
- **Dark mode**: palet navy gelap dengan aksen biru moodboard dan merah yang dicerahkan (`.dark` di `globals.css`). Toggle matahari/bulan di kiri ikon notifikasi; pilihan disimpan di browser (`bk_theme`), dipasang skrip kecil di `<head>` sebelum render agar tidak berkedip. Default tetap terang.
- Token baru `brand-blue-fg` (teks biru yang menyesuaikan tema) dan `brand-rail` (latar sidebar).
- **Menu profil** di top bar (komponen shadcn `dropdown-menu`): nama, role · cabang, Profil saya (segera), Pengaturan (segera), Keluar.

### Changed
- Sidebar: kartu profil + tombol keluar dihapus; menu "Pengaturan" dikeluarkan dari sidebar (ikon pengaturan tetap di top bar).
- Teks biru `text-brand-blue-ink` → `text-brand-blue-fg`; menu aktif sidebar memakai `bg-card` agar cocok di dua tema.
- Halaman login/setup memakai token tema (sebelumnya warna zinc tetap).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser: desktop 1440px terang & gelap (semua kartu terbaca, tema bertahan setelah reload), menu profil terbuka, HP 375px & tablet 768px mode gelap tanpa overflow, halaman login mode gelap.

### File terdampak
`src/app/globals.css`, `src/app/layout.tsx`, `src/lib/theme.ts`, `src/components/topbar-controls.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/lib/navigation.ts`, `src/app/(auth)/layout.tsx`, `src/app/(app)/dashboard/*`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.5] — 2026-11-03
**Ringkasan:** Saat disembunyikan, sidebar menciut menjadi rail ikon (tidak hilang total); tombol panel di top bar dihapus.

### Changed
- Sidebar dua mode: **bentang** (panel berlabel 248px) dan **ciut** (rail ikon 72px: logo, tombol bentang, ikon menu, avatar, keluar). Label muncul sebagai tooltip saat ikon di-hover/fokus.
- Tombol bentang/ciutkan pindah ke dalam sidebar (di bawah logo saat ciut). Pintasan Ctrl/⌘ + B tetap.
- Desktop (≥1024px): konten bergeser 264px ↔ 88px; pilihan disimpan di browser.
- Tablet (768–1023px): default rail ikon (konten bergeser 88px); saat dibentangkan panel melayang di atas konten dengan latar gelap.
- HP (<768px): sidebar tersembunyi; tombol ☰ di top bar hanya tampil di HP untuk membukanya.

### Removed
- Tombol panel di top bar untuk tablet & desktop; komponen `SidebarClose` (diganti `SidebarRailToggle`).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px (ciut → rail 72px, konten 88px), tablet 768px (rail default, tooltip, bentang overlay, tutup lewat latar), HP 375px (☰ membuka panel penuh) — tidak ada halaman yang melebar.

### File terdampak
`src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.4] — 2026-11-03
**Ringkasan:** Sidebar diganti menjadi panel melayang (floating) berlabel yang bisa ditampilkan/disembunyikan manual.

### Changed
- Sidebar: panel biru melayang (sudut membulat, bayangan, jarak dari tepi layar) berisi logo + cabang, daftar menu berlabel (ikon dalam kotak, menu aktif putih dengan ikon merah, chip "Segera"), kartu profil + tombol keluar.
- Show/hide manual: tombol di top bar, tombol tutup di dalam panel, pintasan **Ctrl/⌘ + B**.
- Desktop (≥1024px): default tampil, konten bergeser halus; pilihan tampil/sembunyi disimpan di browser (`localStorage`).
- Tablet & HP: default tersembunyi, panel muncul di atas konten dengan latar gelap; tutup lewat klik latar, Esc, atau pindah halaman.
- Top bar: menu sheet HP dan tombol keluar di HP dihapus (sudah ada di sidebar).

### Removed
- Komponen `IconNav` dan `MobileNav` (diganti `SidebarFrame`, `SidebarToggle`, `SidebarClose`, `SideNav`).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px (dorong konten, pilihan bertahan setelah reload), tablet 768px & HP 375px (overlay; tombol, klik latar, Esc, Ctrl+B, tombol tutup) — tidak ada halaman yang melebar.

### File terdampak
`src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.3] — 2026-11-03
**Ringkasan:** Redesign dashboard mengikuti referensi baru, dominan biru & merah, responsif HP–tablet–desktop.

### Changed
- Tema: primary biru `#3B6A8C` (turunan gelap `#7DAACB`, kontras teks putih ≥ 4.5:1), aksen biru `#7DAACB`, merah `#CE2626` untuk prioritas/peringatan/sorotan. Latar biru keabuan `#EEF3F7`. Pasir & krem hanya aksen kecil. Token baru `brand-blue-deep`.
- Kerangka: pita biru berisi navigasi ikon dengan tooltip (tablet & desktop), top bar (cari, notifikasi, pengaturan, profil). HP: menu sheet biru berlabel + tombol keluar.
- Dashboard: tab halaman, sapaan "Halo, {nama}! Apa rencana bengkel hari ini?", tile aksi cepat (Work order baru, Terima kendaraan, Kasir cepat, Cek stok), Notifikasi, Pekerjaan mekanik, kalender minggu ini + agenda, Work order hari ini (progres), kartu merah Stok menipis, cincin Target omzet & Piutang tertagih, Tutup kas shift.
- Grid 1 kolom (HP) → 2 kolom (tablet) → 12 kolom (desktop); semua kartu `min-w-0` agar tidak meluber.

### Fixed
- Loop reload tanpa henti di dev: cache Turbopack (`.next/dev`) basi setelah refactor nama export. Cache dihapus; `experimental.mcpServer: false` juga dimatikan agar dev tidak menulis log file per request.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px, tablet 768px, HP 375px — lebar halaman = lebar layar, tidak ada kartu yang meluber.

### File terdampak
`src/app/globals.css`, `src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/*`, `src/app/dev/preview/page.tsx`, `src/lib/demo/dashboard.ts`, `next.config.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.2] — 2026-11-03
**Ringkasan:** Tema warna moodboard + redesign layout & dashboard ala referensi, dengan konteks bengkel.

### Changed
- Tema light mode (`globals.css`): merah `#CE2626` (aksi utama), biru `#7DAACB` (aksen; teks pakai `#3B6A8C` agar kontras), pasir `#E8DBB3` (garis/chip), krem `#FFFDEB` (latar). Token `brand-*` tersedia sebagai utility Tailwind. Radius kartu lebih membulat.
- Layout aplikasi: sidebar bergaya tumpukan kartu (profil, cabang, menu dengan item aktif merah, kartu merah "Servis hari ini", aksi cepat, "Buat Work Order baru"). HP: header ringkas + menu sheet.
- Dashboard: alur papan servis (Antri → Dikerjakan → Menunggu Part → QC → Siap Diambil) dengan peringatan, work order berjalan, kapasitas bay, tren omzet 7 hari, skor kesehatan bisnis, pengingat. Kartu disembunyikan sesuai izin role.
- Komponen dipisah: `src/components/app-shell.tsx` (kerangka + sidebar), `dashboard/view.tsx`, `dashboard/widgets.tsx`.

### Added
- `src/lib/demo/dashboard.ts` — data contoh dashboard (berlabel "Data contoh"), diganti view database saat modul jadi.
- `/dev/preview` — pratinjau UI tanpa login, hanya di development (404 di production, tidak dibuka di proxy production).

### Fixed
- Warna tidak tampil di dev: dev server masih memakai CSS lama; perlu restart setelah menambah token `@theme`.
- Titik alur servis tidak pas di garis: kurva kini dihitung melewati titik (Catmull-Rom).
- Label grafik bertumpuk di HP: grafik diberi lebar minimum dan bisa digeser horizontal.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos. Dicek di browser: desktop 1440px dan HP 375px (tanpa horizontal scroll halaman).

### File terdampak
`src/app/globals.css`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/*`, `src/app/dev/preview/page.tsx`, `src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/lib/demo/dashboard.ts`, `src/proxy.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.1] — 2026-11-03
**Ringkasan:** Perbaikan error dashboard & keamanan log dev.

### Fixed
- Error "unstable value `Date.now()` while prerendering" di `/dashboard`: `getUserContext()` kini memanggil `connection()` sebelum mengakses Supabase.
- Error "uncached data outside of `<Suspense>`" di `/dashboard`: data user dipindah ke `DashboardContent` di dalam `<Suspense>` dengan skeleton.

### Security
- Next.js dev mencatat argumen server action ke terminal, termasuk password dari form setup/login. Dimatikan lewat `logging.serverFunctions: false`.

### Verifikasi
- Owner pertama berhasil dibuat lewat `/setup` (EMP-2611-0001, role owner, profil terhubung).
- `tsc`, `eslint`, `next build` lolos.

### File terdampak
`src/lib/auth.ts`, `src/app/(app)/dashboard/page.tsx`, `next.config.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.0] — 2026-11-03
**Ringkasan:** Halaman login, setup Owner pertama, dan layout aplikasi (light mode).

### Added
- Migration `20261103000004_auth_bootstrap.sql`: `public.needs_setup()`, `public.bootstrap_owner()` (hanya service_role, sekali saja, terkunci dari race), `public.my_context()` (karyawan, cabang, role, izin).
- `src/proxy.ts` (Next 16, pengganti middleware): refresh sesi Supabase, redirect ke `/login` jika belum masuk, logout otomatis setelah 12 jam tidak aktif.
- `/setup` — buat akun Owner pertama (muncul hanya jika belum ada karyawan).
- `/login` — email + password; pesan error Bahasa Indonesia (salah password, akun dinonaktifkan, akun tanpa karyawan).
- Layout aplikasi: sidebar (desktop) + menu sheet (HP), header dengan nama, role, cabang, dan tombol keluar. Menu difilter sesuai izin; modul yang belum dibangun bertanda "Segera".
- `/dashboard` — sapaan, tanggal WIB, kartu ringkasan (placeholder sampai modul terkait jadi).
- `src/lib/auth.ts` (`getUserContext`, `requireUser`, `can`), `src/lib/supabase/admin.ts`, `src/lib/validation/auth.ts` (Zod dipakai di client & server), `src/components/form-field.tsx`.
- shadcn: input, label, badge, separator, sheet.

### Fixed
- Halaman reload terus di dev: ada `package-lock.json` di folder home sehingga Turbopack salah root. `turbopack.root` dikunci ke folder proyek.
- Font jatuh ke serif: variabel `--font-sans` dari shadcn merujuk dirinya sendiri, diarahkan ke Geist.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser: `/` → `/login` → `/setup` (karena belum ada karyawan), validasi form tampil benar.
- Belum diuji end-to-end: pembuatan Owner, login, dashboard, logout (menunggu user membuat akun Owner sendiri).

### File terdampak
`supabase/migrations/20261103000004_auth_bootstrap.sql`, `src/proxy.ts`, `src/app/(auth)/**`, `src/app/(app)/**`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/**`, `next.config.ts`, `package.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.2.0] — 2026-11-03
**Ringkasan:** Skema database fondasi: sistem, akses, role & RLS.

### Added
- Migration `20261103000001_foundation_system.sql`:
  - schema `app`, `app.today_wib()`, `app.set_updated_at()`.
  - Tabel `branches`, `settings`, `number_sequences`, `audit_logs` (append-only, tidak bisa update/delete/truncate).
- Migration `20261103000002_access_control.sql`:
  - Tabel `employees`, `profiles` (1–1 `auth.users`), `employee_status_history`, `roles`, `permissions`, `role_permissions` (scope `all`/`own`), `employee_roles`.
  - Helper RLS: `app.current_employee_id()`, `app.current_branch_id()`, `app.is_superuser()`, `app.has_permission(module, action, scope)`.
  - Audit trigger generik `app.audit_row_change()` (tanpa `pin_hash`).
  - Status karyawan: riwayat otomatis + akun Nonaktif diblokir login (`auth.users.banned_until`).
  - Penomoran dokumen atomik `app.next_document_number('INV')` → `INV-2611-0001`.
  - PIN persetujuan bcrypt: `app.set_my_pin()`, `app.verify_approval_pin()` (tercatat di audit log).
  - RLS aktif di semua tabel; anon tanpa akses; `pin_hash` dilindungi dengan grant per kolom.
  - Hapus permanen diblokir untuk master (branches, employees, profiles, roles).
- Migration `20261103000003_seed_roles_permissions.sql`: cabang `PST`, 5 setting awal, 27 modul × 6 aksi (162 izin), 5 role bawaan, matriks default PRD §16 (113 baris).
- `supabase/tests/foundation_test.sql` + `scripts/test-db.mjs` + `npm run test:db`.

### Verifikasi
- `supabase db push` ke Supabase lokal berhasil.
- `npm run test:db`: 33/33 tes lulus (izin kasir/mekanik/owner, RLS, penomoran, audit, PIN, status Nonaktif, integritas). Tes berjalan dalam transaksi + rollback, tidak meninggalkan data.

### Catatan desain
- `permissions` adalah katalog global, jadi tanpa `branch_id` (pengecualian konvensi §15.1).
- Owner = role `is_superuser`, otomatis punya semua izin termasuk modul baru.
- Batas percobaan PIN salah belum ada (perlu rate limit di layer aplikasi).

### File terdampak
`supabase/migrations/*`, `supabase/tests/foundation_test.sql`, `scripts/test-db.mjs`, `package.json`, `package-lock.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.1.1] — 2026-11-03
**Ringkasan:** `npm run dev` di host Windows terhubung ke Supabase.

### Fixed
- Node.js di Windows tidak me-resolve `supabase.localhost`. Ditambah entri hosts `127.0.0.1 supabase.localhost` (setup manual sekali per mesin developer).

### Verifikasi
- `next dev` di host: `/api/v1/health` → `{"status":"ok","version":"0.1.0","supabase":{"ok":true}}`.

### File terdampak
`devlog.md`, `fitur.md`, `VERSION`

---

## [0.1.0] — 2026-11-03
**Ringkasan:** Setup proyek Next.js + Supabase + Docker.

### Added
- Next.js 16.4 (App Router, TypeScript, Tailwind v4, ESLint, `src/`), `lang="id"`.
- shadcn/ui (button, card), Zod, React Hook Form, `@supabase/supabase-js`, `@supabase/ssr`, `server-only`.
- Supabase CLI (devDependency) + folder `supabase/` (`config.toml`, `migrations/`).
- `src/lib/env.ts` — validasi env dengan Zod.
- `src/lib/supabase/client.ts` & `server.ts` — Supabase client browser/server (cookie session).
- `GET /api/v1/health` — status app, versi, dan koneksi Supabase Auth.
- `Dockerfile` (Node 24 alpine, standalone, user non-root, TZ Asia/Jakarta, healthcheck) + `.dockerignore`.
- `next.config.ts` → `output: "standalone"`.
- `.env.example` → `SUPABASE_INTERNAL_URL`.

### Verifikasi
- `tsc --noEmit`, `eslint`, `next build` lolos.
- Image Docker dijalankan di jaringan Supabase: `/api/v1/health` → `{"status":"ok","version":"0.1.0","supabase":{"ok":true}}`, jam container WIB.

### Catatan
- Node.js di Windows tidak me-resolve `supabase.localhost` (browser bisa). Untuk `npm run dev` di host perlu entri hosts `127.0.0.1 supabase.localhost`.

### File terdampak
`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `components.json`, `src/**`, `public/**`, `supabase/**`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example`, `AGENTS.md`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.4] — 2026-11-03
**Ringkasan:** Port Postgres di-publish untuk migration.

### Added
- Port Postgres Supabase di-publish di Coolify lokal: `127.0.0.1:54322` (via proxy container Coolify).
- `DATABASE_URL` di `.env.local` diaktifkan. Login teruji: user `postgres`, PostgreSQL 15.8.

### Catatan
- Port publik hanya untuk development lokal. Jangan diaktifkan di staging/production.

### File terdampak
`devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.3] — 2026-11-03
**Ringkasan:** Supabase self-host berjalan di Coolify lokal.

### Added
- Supabase (12 container) dideploy di Coolify lokal, API via Kong di `http://supabase.localhost`.
- `.env.example` — template variabel env (Supabase URL, anon key, service role key, DATABASE_URL, TZ).
- `.env.local` (tidak di-commit) — diisi kunci asli dari Coolify.

### Fixed
- 503 di `supabase.localhost`: domain Kong masih sslip.io bawaan Coolify. Domain diganti ke `supabase.localhost` port 8000 lalu restart servis.

### Catatan
- Label "DNS mismatch" di Coolify normal untuk domain `.localhost`.
- Port Postgres belum di-publish; diperlukan untuk migration via Supabase CLI.

### File terdampak
`.env.example`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.2] — 2026-11-03
**Ringkasan:** Environment development pindah ke Docker + Coolify lokal.

### Changed
- `CLAUDE.md` — development memakai Docker + Coolify lokal dengan Supabase self-host (bukan Netlify + Supabase Cloud). Ditambah tabel environment dan konsekuensinya (Dockerfile standalone, `.env.example`, Supabase CLI).

### File terdampak
`CLAUDE.md`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.1] — 2026-11-03
**Ringkasan:** Inisialisasi proyek & dokumentasi kerja.

### Added
- `CLAUDE.md` — agent default (Fullstack Developer) beserta aturan teknis dari PRD dan alur versioning.
- `devlog.md` — log perubahan.
- `fitur.md` — daftar fitur & status berdasarkan PRD.
- `VERSION`, `.gitignore`.
- Inisialisasi repository git.

### File terdampak
`CLAUDE.md`, `devlog.md`, `fitur.md`, `VERSION`, `.gitignore`

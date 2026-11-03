# Devlog — Bengkel Mobil App

Catatan setiap perubahan. Entri terbaru di paling atas.

---

## [0.5.1] — 2026-11-03
**Ringkasan:** Perbaiki peringatan Base UI pada tombol yang dirender sebagai link.

### Fixed
- "Base UI: A component that acts as a button expected a native <button>…": `Button` dengan `render={<Link />}` (Tambah karyawan, Tambah role, Batal/Kembali, Buka detail karyawan) kini memakai `nativeButton={false}` agar semantik link benar.

### Verifikasi
- `tsc`, `eslint` lolos; log dev server tidak berisi error lain selain peringatan ini (muncul 3× di `/karyawan`, `/karyawan/role`, `/karyawan/baru`).

### File terdampak
`src/app/(app)/karyawan/page.tsx`, `src/app/(app)/karyawan/role/page.tsx`, `src/app/(app)/karyawan/_components/employee-form.tsx`, `src/app/(app)/karyawan/_components/role-form.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.5.0] — 2026-11-03
**Ringkasan:** Modul Karyawan & Role (PRD §2, §10.1–10.2, §16): kelola karyawan, role ganda, status, akun login, PIN, role dinamis dengan matriks hak akses.

### Added
- Migration `20261103000005_employee_management.sql` — semua perubahan lewat fungsi atomik di database (izin dicek di DB, tercatat audit log):
  - `create_employee`, `update_employee` (validasi & normalisasi NIK 16 digit, HP, rekening; kode `EMP-YYMM-####` otomatis).
  - `set_employee_roles` (role ganda), `set_employee_status` (alasan wajib saat Nonaktif; tersimpan di `employee_status_history.reason`).
  - `link_employee_account` (hanya akun Auth baru ≤10 menit & belum terhubung), `employee_account_for_reset` (atur ulang password, diaudit).
  - `set_my_pin`, `employee_has_pin`; `save_role` (role baru/ubah + matriks izin sekaligus), `set_role_active`.
  - Pengaman: non-Owner tidak bisa memberi/mengubah role atau data Owner; **tanpa eskalasi hak** (non-Owner hanya bisa memberi izin yang ia miliki); minimal satu Owner aktif; tidak bisa mengubah status diri sendiri; role Owner terkunci; role bawaan tidak bisa dinonaktifkan; role nonaktif tidak bisa diberikan.
  - Kolom `permissions.sort_order` (urutan modul untuk matriks).
- Tes DB `supabase/tests/employee_management_test.sql` (37 tes: validasi, role ganda, status & blokir login, akun, batas Owner, admin/HR tanpa eskalasi, role, PIN).
- Halaman `/karyawan`: daftar dengan pencarian & filter status (TanStack Table v9; kartu di HP), `/karyawan/baru` (data + role + akun login opsional), `/karyawan/[id]` (ubah data, role, akun login/atur ulang password, PIN sendiri, status + riwayat).
- Halaman `/karyawan/role`, `/karyawan/role/baru`, `/karyawan/role/[id]`: daftar role (jumlah anggota & izin) dan matriks izin modul × aksi (Lihat/Buat/Ubah/Batal/Setujui/Ekspor; lingkup "semua" atau "hanya data sendiri").
- Validasi Zod bersama (`src/lib/validation/employee.ts`), data fetcher (`src/lib/employees.ts`), server actions (`src/app/(app)/karyawan/actions.ts`). Akun login dibuat lewat Auth Admin API lalu ditautkan oleh DB; dihapus lagi bila penautan gagal.
- Dependensi: `@tanstack/react-table` 9; komponen shadcn checkbox, select, textarea, dialog, table, tabs.

### Changed
- Menu sidebar **Karyawan** aktif; "Profil saya" di menu profil membuka detail karyawan sendiri.
- Sidebar HP ditutup saat link menu diklik (sebelumnya lewat `usePathname` di kerangka, yang memblokir build route dinamis di luar Suspense).
- `FormError` & catatan login memakai token tema (ikut mode gelap).

### Catatan
- Komisi mekanik & penggajian (PRD §10.3–10.4) menunggu modul Servis & Finance.
- Endpoint REST `/api/v1` khusus karyawan belum dibuat; fungsi DB di atas bisa dipanggil klien mana pun lewat Supabase RPC dengan aturan yang sama.

### Verifikasi
- `npm run test:db`: 37 tes baru + 33 tes fondasi lulus. `tsc`, `eslint`, `next build` lolos.
- Bentuk query PostgREST (relasi profil & role, hitungan anggota/izin) dicek terhadap DB lokal.
- Browser: menu Karyawan aktif, `/karyawan` tanpa login dialihkan ke `/login`, dashboard tetap normal.
- **Belum diverifikasi di browser dengan login** (halaman karyawan butuh sesi asli).

### File terdampak
`supabase/migrations/20261103000005_employee_management.sql`, `supabase/tests/employee_management_test.sql`, `src/app/(app)/karyawan/**`, `src/lib/employees.ts`, `src/lib/validation/employee.ts`, `src/lib/navigation.ts`, `src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `src/components/topbar-controls.tsx`, `src/components/form-field.tsx`, `src/components/ui/*`, `src/app/(auth)/login/login-form.tsx`, `package.json`, `package-lock.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.4.5] — 2026-11-03
**Ringkasan:** Logo baru AutoMobi (latar transparan) di sidebar, login/setup, dan favicon.

### Added
- `scripts/make-logo.mjs` (sharp): mengubah `design/automobi-logo-source.jpg` (latar hitam) menjadi PNG transparan. Tiap piksel digolongkan ke warna logo (merah mobil, navy kunci, biru tulisan) dan dibuat solid; alpha dari kecerahan → tepi halus tanpa garis gelap.
- Aset: `public/brand/automobi-logo.png` (latar terang), `public/brand/automobi-logo-dark.png` (mode gelap: navy & biru dicerahkan ke `#7DAACB` agar terbaca), `public/brand/automobi-mark.png` (ikon mobil + kunci), `src/app/icon.png` (favicon).

### Changed
- Sidebar: tile merah ikon kunci → tile putih berisi ikon AutoMobi; nama "AutoMobi" + nama cabang.
- Login/setup: logo lengkap AutoMobi (otomatis varian terang/gelap).
- Judul tab browser: "AutoMobi".

### Removed
- `src/app/favicon.ico` bawaan Next (diganti `icon.png`).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos; aset `/brand/*` & `/icon.png` bisa diakses tanpa login (200).
- Browser: sidebar HP terbuka, login terang & gelap, console bersih.

### File terdampak
`scripts/make-logo.mjs`, `design/automobi-logo-source.jpg`, `public/brand/*`, `src/app/icon.png`, `src/app/favicon.ico`, `src/components/app-shell.tsx`, `src/app/(auth)/layout.tsx`, `src/app/layout.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.4] — 2026-11-03
**Ringkasan:** Radius sudut kartu dashboard diperkecil.

### Changed
- Kartu dashboard `rounded-3xl` (±35px) → `rounded-md` (12,8px), termasuk skeleton & kartu merah stok menipis.
- Elemen di dalam kartu (item notifikasi, baris WO, tile, ikon, badge, tombol) `rounded-2xl/xl/lg` → `rounded-sm` (9,6px) agar tidak lebih bulat dari kartunya. Bentuk lingkaran (`rounded-full`) tetap.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos; browser 1440px: semua kartu radius 12,8px.

### File terdampak
`src/app/(app)/dashboard/widgets.tsx`, `src/app/(app)/dashboard/view.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.3] — 2026-11-03
**Ringkasan:** Peringatan "Encountered a script tag while rendering React component" benar-benar dihilangkan.

### Fixed
- `next/script` (`beforeInteractive`) ternyata tetap menghasilkan elemen `<script>` yang dibuat React di browser saat root layout dirender ulang (Fast Refresh/pemulihan render), sehingga peringatan masih muncul. Skrip tema kini disisipkan lewat `useServerInsertedHTML` (komponen `ThemeScript`): hanya ada di HTML dari server (di `<head>`, satu kali), tidak pernah dirender React di browser.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos; skrip ada tepat 1× di `<head>` HTML dev (`/login`, `/dev/preview`) dan di hasil prerender production (`.next/server/app/*.html`).
- Browser tab baru: mode gelap aktif sebelum hydrate (latar langsung navy), console bersih termasuk setelah `layout.tsx` diubah.

### File terdampak
`src/components/theme-script.tsx`, `src/app/layout.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.2] — 2026-11-03
**Ringkasan:** Perbaiki error hydration mismatch tombol sidebar dan peringatan "script tag" skrip tema.

### Fixed
- **Hydration mismatch** (tombol ciut/bentang sidebar & tombol menu HP): tombol berada di dalam Suspense yang di-hydrate belakangan sehingga membaca status sidebar versi browser lewat context, sementara HTML server memakai default. Kini `useSidebar()` membaca store langsung via `useSyncExternalStore` (snapshot server saat hydrate); context hanya membawa `mobileOpen` & `toggle`.
- **"Encountered a script tag while rendering React component"**: skrip tema di `<head>` diganti `next/script` dengan `strategy="beforeInteractive"` (tetap jalan sebelum hydrate, tanpa kedipan).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser tab baru: sidebar posisi ciut + mode gelap setelah reload → tidak ada error di console & log server; halaman login bersih.

### File terdampak
`src/components/app-nav.tsx`, `src/app/layout.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.1] — 2026-11-03
**Ringkasan:** Ukuran huruf dinaikkan secara proporsional dan angka metrik diperbesar agar mudah dibaca owner.

### Changed
- Skala teks di tema (`@theme`): `xs` 12→13px, `sm` 14→15px, `base` 16→17px, `lg` 18→19px; ukuran baru `2xs` 12px. Semua teks 10–11px diganti `text-2xs`, jadi minimum 12px.
- Metrik dashboard: persen cincin target 72px dengan angka tebal, progres & durasi work order `text-sm` tebal `tabular-nums` (bar progres lebih tebal), angka stok menipis `text-4xl`.
- Kartu target disusun ulang (judul di atas, cincin + keterangan di bawah) agar label tidak meluber.
- Sidebar bentang 248→264px (konten 280px) agar label menu tidak terlalu terpotong.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px, tablet 768px, HP 375px — lebar halaman = layar, tidak ada teks meluber.

### File terdampak
`src/app/globals.css`, `src/app/(app)/dashboard/widgets.tsx`, `src/app/(app)/dashboard/view.tsx`, `src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `src/components/topbar-controls.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

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

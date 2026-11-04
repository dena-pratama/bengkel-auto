# Catatan serah terima: redesain UI/UX dari Figma

Dokumen ini untuk melanjutkan redesain di alat/sesi lain (mis. Antigravity). Baca juga `CLAUDE.md` (aturan wajib proyek) dan `cek-halaman.md`.

## Posisi saat ini
- Cabang kerja: `ui-ux-redesign` (dari `f2efb5a`, v0.33.0). Tampilan lama tersimpan di tag/cabang `ui-ux-base`; jangan diubah.
- Selesai: tahap 1 fondasi (v0.34.0), tahap 2 kerangka (v0.35.0), Beranda data nyata (v0.36.0).
- Sisa: halaman per modul (urutan usulan): Kasir, Servis, Barang & Jasa, Pembelian, Pelanggan, Stok Opname, Keuangan, Penggajian, Pajak, Karyawan, AI Analyst, Audit Log, pop up form, Pengaturan, Notifikasi. Tiap modul Light, Dark, Mobile.
- Cabang belum di-push ke remote (kecuali user sudah mengizinkan setelah catatan ini).

## Sumber desain
- File Figma "Bengkel-App UI" (16 halaman, Desktop dan Mobile, Light dan Dark). Dulu dibaca lewat Figma Console MCP. Frame Beranda Desktop Light: `1:1629`.
- Keputusan user: Beranda pakai data nyata (tanpa kalender booking dan target omzet), pilihan cabang hanya label, pencarian global hanya tampilan.

## Token dan komponen (jangan buat gaya baru, pakai ini)
- Warna di `src/app/globals.css`. Nama `brand-*` dipertahankan, nilainya palet Figma: `brand-blue`, `brand-blue-ink`, `brand-blue-fg`, `brand-blue-soft`, `brand-rail` (biru aktif), `brand-red(-soft)`, `brand-sand(-soft)` (kuning), `brand-green(-soft)`. Dark lewat kelas `dark`.
- Radius: tombol/isian `rounded-lg` (8 px), kartu `rounded-xl` (12 px), dialog `rounded-2xl`, lencana `rounded-full`. Skala teks: `text-2xs` 11, `xs` 12, `sm` 14, `base` 16, `lg` 18; judul halaman 26 px. Font Inter.
- `src/components/page-kit.tsx`: `panel` (kartu datar bergaris), `inputClass`, `SectionNav` (tab bagian), judul halaman. `ui/button.tsx`, `ui/input.tsx`, `form-dialog.tsx`, `app-toaster.tsx` sudah disesuaikan.
- Filter daftar: `ListFilter` / `LocalFilters` / `src/lib/list-filter.ts`. Lampiran: `AttachmentPanel`. Avatar: `UserAvatar`.
- Kerangka: `app-nav.tsx`, `app-shell.tsx`, `navigation.ts`, `topbar-controls.tsx`, `notification-bell.tsx`.
- Contoh halaman yang sudah dibangun ulang: `src/app/(app)/dashboard/` (view, widgets) dengan pemuat data `src/lib/dashboard.ts`.

## Cara memverifikasi tampilan
- Halaman di balik login tidak bisa dibuka tanpa akun. Untuk lihat tampilan tanpa login, buat halaman pratinjau di `src/app/dev/preview/<nama>/page.tsx` (hanya aktif saat `NODE_ENV=development`, 404 di production) dengan data contoh, seperti `/dev/preview` (Beranda) dan `/dev/preview/fondasi`.
- Bandingkan dengan screenshot frame Figma, Light dan Dark (tombol tema di bilah atas) dan lebar mobile 375 px (cek tidak ada scroll horizontal).
- Cek login nyata (Owner) memakai daftar di `cek-halaman.md`.

## Aturan proyek yang gampang terlewat
- Tanpa tanda pisah panjang (em dash dan en dash) di mana pun, termasuk teks UI, komentar, SQL, dokumen.
- Setiap perubahan kode: naikkan versi (SemVer, `VERSION` dan `package.json`), entri baru paling atas `devlog.md`, status `fitur.md`, commit `Update ver X.Y.Z: ringkasan` dan tag `vX.Y.Z`. Redesain tiap modul = minor.
- Logika inti tetap di database; redesain hanya menyentuh tampilan. Jangan ubah perilaku, izin (RLS), atau skema.
- Jangan edit `devlog.md`/`fitur.md` memakai `Set-Content` PowerShell 5.1 (merusak UTF-8).
- Setelah `next build`, hapus `.next` dan mulai ulang dev server (cache Turbopack basi).
- Validasi sebelum commit: `npx tsc --noEmit`, `npx eslint src`, `npx next build`.

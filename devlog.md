# Devlog — Bengkel Mobil App

Catatan setiap perubahan. Entri terbaru di paling atas.

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

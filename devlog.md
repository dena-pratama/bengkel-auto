# Devlog — Bengkel Mobil App

Catatan setiap perubahan. Entri terbaru di paling atas.

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

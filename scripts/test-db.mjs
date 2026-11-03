// Jalankan semua tes SQL di supabase/tests terhadap DATABASE_URL (.env.local).
// psql dijalankan lewat image Docker postgres agar tidak perlu install psql di host.
// URL (berisi password) dikirim lewat env container, bukan argumen, agar tidak tercetak saat tes gagal.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = (process.env.DATABASE_URL ?? env.DATABASE_URL)?.replace(/@(127\.0\.0\.1|localhost):/, "@host.docker.internal:");
if (!url) throw new Error("DATABASE_URL belum diisi di .env.local");

const dir = resolve("supabase/tests");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  console.log(`\n▶ ${file}`);
  try {
    execFileSync(
      "docker",
      ["run", "--rm", "-e", "DATABASE_URL", "-v", `${dir}:/tests`, "postgres:15-alpine",
       "sh", "-c", `psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f /tests/${file}`],
      { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
    );
  } catch {
    console.error(`\n✖ ${file} gagal (lihat pesan psql di atas)`);
    process.exit(1);
  }
}

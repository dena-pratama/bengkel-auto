// Jalankan semua tes SQL di supabase/tests terhadap DATABASE_URL (.env.local).
// psql dijalankan lewat image Docker postgres agar tidak perlu install psql di host.
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
  execFileSync(
    "docker",
    ["run", "--rm", "-v", `${dir}:/tests`, "postgres:15-alpine", "psql", url, "-q", "-v", "ON_ERROR_STOP=1", "-f", `/tests/${file}`],
    { stdio: "inherit" },
  );
}

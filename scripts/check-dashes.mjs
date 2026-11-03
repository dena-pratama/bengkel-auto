// Cek tidak ada tanda pisah panjang (em dash U+2014, en dash U+2013) di file yang di-track git.
// Pengecualian: AGENTS.md (dibuat ulang otomatis oleh next dev) dan supabase/config.toml (bawaan Supabase CLI).
// Jalankan: npm run check:dashes
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SKIP = /(^AGENTS\.md$|^supabase\/config\.toml$|package-lock\.json$|\.(png|jpe?g|ico|docx|webp)$)/;
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !SKIP.test(f) && existsSync(f));

const hits = [];
for (const f of files) {
  readFileSync(f, "utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (DASH.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
}

if (hits.length) {
  console.error(`Ditemukan ${hits.length} baris dengan tanda pisah panjang:\n${hits.join("\n")}`);
  process.exit(1);
}
console.log(`OK: ${files.length} file bebas tanda pisah panjang.`);

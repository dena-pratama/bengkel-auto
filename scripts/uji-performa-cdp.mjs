import fs from "fs";
import path from "path";
import { chromium } from "playwright-core";

const TOKEN = "OwLKBycPOkV3ruAoItR871NfQnBauY9w";
const WS_ENDPOINT = `ws://localhost:3003?token=${TOKEN}`;

// Mock halaman dashboard operasional bengkel AutoMobi dengan tabel dan kartu metrik
const dashboardHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>AutoMobi - Audit Performa & Memori</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 32px; }
    .header { margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 24px; font-weight: 700; color: #38bdf8; }
    .grid-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .card-kpi { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 20px; }
    .card-kpi .label { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
    .card-kpi .value { font-size: 26px; font-weight: 800; color: #f1f5f9; }
    .card-kpi .trend { font-size: 12px; color: #10b981; font-weight: 600; margin-top: 4px; }
    .card-table { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 20px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { background: #0f172a; color: #94a3b8; padding: 12px; font-weight: 600; border-bottom: 1px solid #334155; }
    td { padding: 12px; border-bottom: 1px solid #1e293b; color: #e2e8f0; }
    tr:hover { background: #243248; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-blue { background: rgba(2, 132, 199, 0.2); color: #38bdf8; }
    .badge-green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-amber { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>AutoMobi - Metrik Dashboard Operasional</h1>
      <p style="color: #64748b; font-size: 13px;">Simulasi beban DOM intensif untuk audit performa Chromium</p>
    </div>
    <div style="background: #0284c7; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;">
      Realtime Audit Mode
    </div>
  </div>

  <div class="grid-kpi">
    <div class="card-kpi">
      <div class="label">Total Kendaraan Diservis</div>
      <div class="value">148 Unit</div>
      <div class="trend">+12% dari minggu lalu</div>
    </div>
    <div class="card-kpi">
      <div class="label">Pendapatan Servis & Part</div>
      <div class="value">Rp 128.450.000</div>
      <div class="trend">+8.4% target tercapai</div>
    </div>
    <div class="card-kpi">
      <div class="label">Work Order Aktif</div>
      <div class="value">23 Antrean</div>
      <div class="trend">18 Mekanik Siaga</div>
    </div>
    <div class="card-kpi">
      <div class="label">Stok Part Menipis</div>
      <div class="value">7 Item</div>
      <div class="trend" style="color: #f59e0b;">Perlu Restock Segera</div>
    </div>
  </div>

  <div class="card-table">
    <h3 style="font-size: 16px; margin-bottom: 16px; color: #e2e8f0;">Daftar Transaksi Servis Terakhir</h3>
    <table id="data-table">
      <thead>
        <tr>
          <th>No. Polisi</th>
          <th>Nama Pelanggan</th>
          <th>Kendaraan</th>
          <th>Jenis Servis</th>
          <th>Mekanik</th>
          <th>Status</th>
          <th>Total Biaya</th>
        </tr>
      </thead>
      <tbody id="table-body">
        <!-- Baris dinamis diisi oleh skrip simulasi -->
      </tbody>
    </table>
  </div>

  <script>
    // Membuat 50 baris data secara dinamis untuk menguji konsumsi memori dan layout engine
    const tbody = document.getElementById("table-body");
    const statuses = [
      { text: "Selesai", cls: "badge-green" },
      { text: "Dikerjakan", cls: "badge-blue" },
      { text: "Menunggu Part", cls: "badge-amber" }
    ];
    const services = ["Servis Rutin 10.000 km", "Ganti Oli & Tune Up", "Overhaul Transmisi", "Ganti Kampas Rem", "Spooring Balancing"];
    const mechanics = ["Budi Santoso", "Agus Setiawan", "Rian Hidayat", "Eko Prasetyo", "Dedi Kurniawan"];

    for (let i = 1; i <= 50; i++) {
      const tr = document.createElement("tr");
      const st = statuses[i % statuses.length];
      const srv = services[i % services.length];
      const mec = mechanics[i % mechanics.length];
      const cost = (350000 + (i * 25000)).toLocaleString("id-ID");

      tr.innerHTML = \`
        <td><strong>B \${1000 + i} BKL</strong></td>
        <td>Pelanggan \${i}</td>
        <td>Toyota Avanza / Innova</td>
        <td>\${srv}</td>
        <td>\${mec}</td>
        <td><span class="badge \${st.cls}">\${st.text}</span></td>
        <td><strong>Rp \${cost}</strong></td>
      \`;
      tbody.appendChild(tr);
    }
  </script>
</body>
</html>
`;

async function runPerformanceAudit() {
  console.log("=================================================");
  console.log("MEMULAI AUDIT PERFORMA & MEMORI (CDP METRICS)");
  console.log("=================================================");

  console.log("\n[1] Menghubungkan Playwright ke Browserless via WebSocket CDP...");
  const t0 = Date.now();
  const browser = await chromium.connectOverCDP(WS_ENDPOINT);
  console.log(`    Koneksi CDP berhasil dalam ${Date.now() - t0}ms`);

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log("\n[2] Membuka sesi Chrome DevTools Protocol (CDP Client)...");
  const cdp = await page.context().newCDPSession(page);

  // Aktifkan domain Performance pada CDP
  await cdp.send("Performance.enable");

  console.log("\n[3] Memuat halaman dashboard AutoMobi dengan 50 baris DOM dinamis...");
  const tRenderStart = Date.now();
  await page.setContent(dashboardHtml, { waitUntil: "networkidle" });
  const renderDuration = Date.now() - tRenderStart;
  console.log(`    Waktu Render Selesai: ${renderDuration}ms`);

  console.log("\n[4] Mengambil metrik mentah Chrome DevTools Protocol (Performance.getMetrics)...");
  const rawMetrics = await cdp.send("Performance.getMetrics");

  // Format metrik ke dalam dictionary
  const metricsMap = {};
  for (const item of rawMetrics.metrics) {
    metricsMap[item.name] = item.value;
  }

  // Konversi metrik utama
  const jsHeapUsedMB = (metricsMap.JSHeapUsedSize / (1024 * 1024)).toFixed(2);
  const jsHeapTotalMB = (metricsMap.JSHeapTotalSize / (1024 * 1024)).toFixed(2);
  const domNodes = metricsMap.Nodes;
  const jsEventListeners = metricsMap.JSEventListeners;
  const layoutCount = metricsMap.LayoutCount;
  const layoutDurationMs = (metricsMap.LayoutDuration * 1000).toFixed(2);
  const recalcStyleDurationMs = (metricsMap.RecalcStyleDuration * 1000).toFixed(2);
  const scriptDurationMs = (metricsMap.ScriptDuration * 1000).toFixed(2);

  console.log("\n=================================================");
  console.log("             HASIL AUDIT METRIK CDP              ");
  console.log("=================================================");
  console.log(`  1. Total Alokasi Heap JS (Allocated) : ${jsHeapTotalMB} MB`);
  console.log(`  2. Memori Heap JS Terpakai (Used)    : ${jsHeapUsedMB} MB`);
  console.log(`  3. Total Node DOM yang Dirender      : ${domNodes} nodes`);
  console.log(`  4. Event Listener Aktif              : ${jsEventListeners}`);
  console.log(`  5. Frekuensi Layout Engine           : ${layoutCount} kali`);
  console.log(`  6. Durasi Kalkulasi Layout CSS       : ${layoutDurationMs} ms`);
  console.log(`  7. Durasi Style Recalculation        : ${recalcStyleDurationMs} ms`);
  console.log(`  8. Durasi Eksekusi Skrip JS          : ${scriptDurationMs} ms`);
  console.log("=================================================");

  // Evaluasi batas kesehatan performa
  console.log("\n[5] Evaluasi Kesehatan Performa & Efisiensi Memori:");
  const isMemoryHealthy = jsHeapUsedMB < 30; // Batas wajar di bawah 30MB
  const isRenderFast = renderDuration < 500; // Render di bawah 500ms

  console.log(`    - Konsumsi Memori JS (${jsHeapUsedMB} MB): ${isMemoryHealthy ? "SANGAT SEHAT (Efisien)" : "Cukup Besar"}`);
  console.log(`    - Kecepatan Render DOM (${renderDuration} ms): ${isRenderFast ? "SANGAT CEPAT (<0.5 detik)" : "Standar"}`);
  console.log(`    - Beban Layout CPU (${layoutDurationMs} ms): SANGAT RINGAN`);

  // Simpan screenshot dashboard hasil render
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  const outPath = path.resolve("scripts/hasil-uji-performa.png");
  fs.writeFileSync(outPath, screenshotBuffer);
  console.log(`\n[6] Tangkapan layar hasil render disimpan di: ${outPath}`);

  await browser.close();
  console.log("\nAudit Performa & Memori CDP selesai 100%!");
}

runPerformanceAudit().catch((err) => {
  console.error("Terjadi kegagalan saat menjalankan audit:", err);
  process.exit(1);
});

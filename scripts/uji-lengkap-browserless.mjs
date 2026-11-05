import fs from "fs";
import path from "path";
import { chromium } from "playwright-core";

const TOKEN = "OwLKBycPOkV3ruAoItR871NfQnBauY9w";
const BASE_HTTP = "http://localhost:3003";
const WS_ENDPOINT = `ws://localhost:3003?token=${TOKEN}`;

const sampleInvoiceHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Nota Servis AutoMobi</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px; color: #1e293b; background: #ffffff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 26px; font-weight: 800; color: #0284c7; }
    .brand span { color: #e11d48; }
    .meta { text-align: right; font-size: 13px; color: #64748b; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #0284c7; color: white; text-align: left; padding: 10px 12px; border-radius: 4px; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .total-box { margin-left: auto; width: 280px; background: #f1f5f9; padding: 16px; border-radius: 12px; }
    .total-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .total-row.grand { font-size: 16px; font-weight: 800; color: #0284c7; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
    .badge { display: inline-block; padding: 4px 10px; background: #dcfce7; color: #166534; font-weight: 700; border-radius: 9999px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Auto<span>Mobi</span></div>
      <div style="font-size: 12px; color: #64748b;">Sistem Manajemen Bengkel Modern</div>
    </div>
    <div class="meta">
      <strong>No. Nota: WO-2026-0089</strong><br />
      Tanggal: 05 November 2026<br />
      Status: <span class="badge">LUNAS</span>
    </div>
  </div>

  <div class="info-grid">
    <div>
      <strong>Data Pelanggan:</strong><br />
      Nama: Dena Pratama<br />
      No. Telepon: 0812-3456-7890
    </div>
    <div>
      <strong>Data Kendaraan:</strong><br />
      Mobil: Honda Civic Turbo 2022<br />
      No. Polisi: B 1234 BKL
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>Deskripsi Pekerjaan / Part</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Harga</th>
        <th class="text-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Oli Mesin Fully Synthetic 5W-30 (4L)</td>
        <td class="text-right">1</td>
        <td class="text-right">Rp 480.000</td>
        <td class="text-right">Rp 480.000</td>
      </tr>
      <tr>
        <td>2</td>
        <td>Filter Oli Original Honda</td>
        <td class="text-right">1</td>
        <td class="text-right">Rp 65.000</td>
        <td class="text-right">Rp 65.000</td>
      </tr>
      <tr>
        <td>3</td>
        <td>Jasa Servis Berkala & Tune Up</td>
        <td class="text-right">1</td>
        <td class="text-right">Rp 250.000</td>
        <td class="text-right">Rp 250.000</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <div class="total-row"><span>Subtotal:</span><span>Rp 795.000</span></div>
    <div class="total-row"><span>PPN (11%):</span><span>Rp 87.450</span></div>
    <div class="total-row grand"><span>Total Akhir:</span><span>Rp 882.450</span></div>
  </div>
</body>
</html>
`;

async function main() {
  console.log("==========================================");
  console.log("MEMULAI PENGUJIAN LANGSUNG BROWSERLESS");
  console.log("==========================================");

  // UJI 1: Status Mesin & Tekanan Resource (CPU & Memori)
  console.log("\n[Uji 1/3] Memeriksa status kesehatan mesin Browserless...");
  const pressureRes = await fetch(`${BASE_HTTP}/pressure?token=${TOKEN}`);
  const pressureData = await pressureRes.json();
  console.log("  Status API:", pressureRes.status, pressureRes.statusText);
  console.log("  Resource CPU:", pressureData.pressure.cpu, "%");
  console.log("  Resource Memori:", pressureData.pressure.memory, "%");
  console.log("  Kapasitas Bersamaan (Max Concurrent):", pressureData.pressure.maxConcurrent);
  console.log("  Hasil Uji 1: SUKSES (Browserless aktif & responsif)");

  // UJI 2: Pembuatan Dokumen PDF Berkualitas Tinggi via REST API
  console.log("\n[Uji 2/3] Menguji generate PDF Dokumen Nota Servis...");
  const pdfRes = await fetch(`${BASE_HTTP}/pdf?token=${TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      html: sampleInvoiceHtml,
      options: {
        format: "A4",
        printBackground: true,
        margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
      },
    }),
  });

  if (!pdfRes.ok) {
    throw new Error(`Gagal membuat PDF: ${pdfRes.statusText}`);
  }

  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  const pdfPath = path.resolve("scripts/hasil-uji-nota.pdf");
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`  File PDF berhasil dibuat: ${pdfPath}`);
  console.log(`  Ukuran berkas PDF: ${pdfBuffer.length} bytes`);
  console.log("  Hasil Uji 2: SUKSES (PDF berhasil dicetak oleh Chromium headless)");

  // UJI 3: Otomasi Playwright via WebSocket CDP
  console.log("\n[Uji 3/3] Menguji otomatisasi browser Playwright via WebSocket CDP...");
  const startTime = Date.now();
  const browser = await chromium.connectOverCDP(WS_ENDPOINT);
  console.log(`  Terhubung ke CDP dalam ${Date.now() - startTime}ms`);

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(sampleInvoiceHtml);

  // Validasi DOM & teks lewat Playwright
  const title = await page.title();
  const grandTotal = await page.locator(".total-row.grand span:last-child").innerText();
  console.log(`  Judul Dokumen yang terdeteksi: "${title}"`);
  console.log(`  Total Biaya yang terbaca dari DOM: "${grandTotal}"`);

  // Buat screenshot resolusi tinggi
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  const screenshotPath = path.resolve("scripts/hasil-uji-screenshot.png");
  fs.writeFileSync(screenshotPath, screenshotBuffer);
  console.log(`  File screenshot berhasil disimpan: ${screenshotPath}`);
  console.log(`  Ukuran berkas gambar: ${screenshotBuffer.length} bytes`);

  await browser.close();
  console.log("  Hasil Uji 3: SUKSES (Playwright sukses mengontrol Browserless)");

  console.log("\n==========================================");
  console.log("SELURUH PENGUJIAN SELESAI DENGAN STATUS: 100% SUKSES");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("Terjadi kegagalan saat pengujian:", err);
  process.exit(1);
});

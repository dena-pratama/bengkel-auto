import { chromium } from "playwright-core";

const WS_ENDPOINT = process.env.PLAYWRIGHT_SERVICE_URL || "ws://localhost:3003?token=OwLKBycPOkV3ruAoItR871NfQnBauY9w";

async function run() {
  console.log(`Menghubungkan Playwright ke Browserless di: ${WS_ENDPOINT}`);
  const startTime = Date.now();

  const browser = await chromium.connectOverCDP(WS_ENDPOINT);
  const duration = Date.now() - startTime;
  console.log(`Berhasil terhubung via CDP dalam ${duration}ms!`);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>AutoMobi CI/CD Playwright Test</title>
        <style>
          body { font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; }
          .card { background: #1e293b; padding: 24px; border-radius: 16px; border: 1px solid #334155; }
          h1 { color: #38bdf8; margin-top: 0; }
          .badge { display: inline-block; padding: 4px 12px; background: #0284c7; border-radius: 9999px; font-weight: 600; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">CI/CD Pipeline Ready</span>
          <h1>AutoMobi Bengkel App</h1>
          <p>Uji koneksi Playwright ke Browserless container di Coolify berhasil.</p>
          <div id="timestamp"></div>
        </div>
        <script>
          document.getElementById('timestamp').innerText = 'Waktu Render: ' + new Date().toISOString();
        </script>
      </body>
    </html>
  `);

  const title = await page.title();
  console.log(`Judul Halaman: "${title}"`);

  const renderedText = await page.locator(".card p").innerText();
  console.log(`Isi Elemen: "${renderedText}"`);

  const timestamp = await page.locator("#timestamp").innerText();
  console.log(`Hasil Eksekusi JS Chromium: "${timestamp}"`);

  const screenshot = await page.screenshot();
  console.log(`Screenshot berhasil dibuat (ukuran buffer: ${screenshot.length} bytes)`);

  await browser.close();
  console.log("Pengujian Playwright + Browserless selesai dengan sukses!");
}

run().catch((err) => {
  console.error("Gagal menjalankan uji Playwright:", err);
  process.exit(1);
});

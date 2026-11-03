// Ubah logo berlatar hitam (design/automobi-logo-source.jpg) menjadi PNG transparan:
//   public/brand/automobi-logo.png       — logo lengkap untuk latar terang
//   public/brand/automobi-logo-dark.png  — logo lengkap untuk latar gelap (navy/biru dicerahkan)
//   public/brand/automobi-mark.png       — ikon mobil + kunci saja (persegi)
//   src/app/icon.png                     — favicon (dari ikon)
// Cara: tiap piksel digolongkan ke salah satu warna logo (merah mobil, navy kunci, biru tulisan);
// warnanya dibuat solid dan alpha = kecerahan piksel / kecerahan warna solid, sehingga tepi
// anti-alias di atas hitam menjadi transparan tanpa garis gelap.
// Jalankan: node scripts/make-logo.mjs
import sharp from "sharp";

const SRC = "design/automobi-logo-source.jpg";
const BG = 14; // kecerahan maksimum yang masih dianggap latar hitam

const { data: src, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (x, y) => (y * W + x) * 3;
const bright = (i) => Math.max(src[i], src[i + 1], src[i + 2]);

// Batas vertikal: ikon (atas) dan tulisan (bawah) dipisah baris kosong
const rowFilled = Array.from({ length: H }, (_, y) => {
  for (let x = 0; x < W; x++) if (bright(px(x, y)) > 60) return true;
  return false;
});
const top = rowFilled.indexOf(true);
const bottom = rowFilled.lastIndexOf(true);
let gap = top;
while (rowFilled[gap]) gap++;

// Kelas warna: 0 merah, 1 navy (kunci, di area ikon), 2 biru (tulisan "Mobi")
const classOf = (i, y) => (src[i] > src[i + 2] ? 0 : y < gap ? 1 : 2);

// Warna solid tiap kelas = rata-rata piksel paling terang di kelas itu
const acc = [0, 1, 2].map(() => ({ r: 0, g: 0, b: 0, n: 0, max: 0 }));
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = px(x, y);
    const m = bright(i);
    if (m > acc[classOf(i, y)].max) acc[classOf(i, y)].max = m;
  }
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = px(x, y);
    const c = acc[classOf(i, y)];
    if (bright(i) >= c.max * 0.85) {
      c.r += src[i];
      c.g += src[i + 1];
      c.b += src[i + 2];
      c.n++;
    }
  }
const solid = acc.map((c) => [c.r / c.n, c.g / c.n, c.b / c.n].map(Math.round));

function render(colors) {
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = px(x, y);
      const o = (y * W + x) * 4;
      const m = bright(i);
      if (m <= BG) continue;
      const k = classOf(i, y);
      const ref = Math.max(...solid[k]);
      const a = Math.min(1, (m - BG) / (ref * 0.9 - BG));
      [out[o], out[o + 1], out[o + 2]] = colors[k];
      out[o + 3] = Math.round(a * 255);
    }
  return out;
}

const pad = 12;
function bounds(buf, y0, y1) {
  let l = W,
    r = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < W; x++)
      if (buf[(y * W + x) * 4 + 3] > 40) {
        if (x < l) l = x;
        if (x > r) r = x;
      }
  return { left: l - pad, top: y0 - pad, width: r - l + 2 * pad, height: y1 - y0 + 2 * pad };
}
const raw = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 4 } });

const light = render(solid);
// Varian gelap: merah tetap, navy & biru dicerahkan (palet moodboard) agar terbaca di latar navy
const dark = render([solid[0], [125, 170, 203], [125, 170, 203]]);

const full = bounds(light, top, bottom);
await raw(light).extract(full).png({ compressionLevel: 9 }).toFile("public/brand/automobi-logo.png");
await raw(dark).extract(full).png({ compressionLevel: 9 }).toFile("public/brand/automobi-logo-dark.png");

const m = bounds(light, top, gap - 1);
const side = Math.max(m.width, m.height);
const mark = await raw(light)
  .extract(m)
  .extend({
    top: Math.floor((side - m.height) / 2),
    bottom: Math.ceil((side - m.height) / 2),
    left: Math.floor((side - m.width) / 2),
    right: Math.ceil((side - m.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();
await sharp(mark).resize(512, 512).png({ compressionLevel: 9 }).toFile("public/brand/automobi-mark.png");
await sharp(mark).resize(256, 256).png({ compressionLevel: 9 }).toFile("src/app/icon.png");

console.log({ W, H, top, bottom, gap, solid });

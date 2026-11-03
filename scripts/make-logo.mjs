import sharp from "sharp";

const LIGHT_SRC = "design/automobi-logo-light-source.jpg";
const DARK_SRC = "design/automobi-logo-dark-source.jpg";

const W = 1024;
const H = 540;

const { data: lightRaw } = await sharp(LIGHT_SRC).resize(W, H).raw().toBuffer({ resolveWithObject: true });
const { data: darkRaw } = await sharp(DARK_SRC).resize(W, H).raw().toBuffer({ resolveWithObject: true });

// Compute alpha channel for every pixel
const alpha = new Uint8Array(W * H);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = y * W + x;
    const i = idx * 3;

    // Eliminate regions outside the logo bounds (removes 'LIGHT MODE'/'DARK MODE' text at bottom)
    if (y < 100 || y >= 435 || x < 180 || x > 840) {
      alpha[idx] = 0;
      continue;
    }

    const lLight = (lightRaw[i] + lightRaw[i + 1] + lightRaw[i + 2]) / 3;
    const lDark = (darkRaw[i] + darkRaw[i + 1] + darkRaw[i + 2]) / 3;
    const delta = lLight - lDark;

    const satLight = Math.max(lightRaw[i], lightRaw[i + 1], lightRaw[i + 2]) - Math.min(lightRaw[i], lightRaw[i + 1], lightRaw[i + 2]);
    const satDark = Math.max(darkRaw[i], darkRaw[i + 1], darkRaw[i + 2]) - Math.min(darkRaw[i], darkRaw[i + 1], darkRaw[i + 2]);
    const maxSat = Math.max(satLight, satDark);

    let a = 0;
    if (delta <= 65) {
      a = 255;
    } else if (delta >= 145) {
      a = 0;
    } else {
      a = Math.round((1 - (delta - 65) / 80) * 255);
    }

    // Preserve saturated logo colors with full solid alpha
    if (maxSat > 25) {
      a = Math.max(a, 255);
    } else if (maxSat > 14) {
      a = Math.max(a, 220);
    }

    alpha[idx] = a;
  }
}

// Find bounding box of full logo
let minX = W, maxX = 0, minY = H, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const a = alpha[y * W + x];
    if (a > 30) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = 16;
const fullLeft = Math.max(0, minX - pad);
const fullTop = Math.max(0, minY - pad);
const fullWidth = Math.min(W - fullLeft, maxX - minX + 1 + pad * 2);
const fullHeight = Math.min(H - fullTop, maxY - minY + 1 + pad * 2);

console.log('Full logo crop:', { fullLeft, fullTop, fullWidth, fullHeight });

// Build RGBA buffers for light and dark full logos
const lightRGBA = Buffer.alloc(W * H * 4);
const darkRGBA = Buffer.alloc(W * H * 4);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const idx = y * W + x;
    const i = idx * 3;
    const o = idx * 4;
    const a = alpha[idx];

    lightRGBA[o] = lightRaw[i];
    lightRGBA[o + 1] = lightRaw[i + 1];
    lightRGBA[o + 2] = lightRaw[i + 2];
    lightRGBA[o + 3] = a;

    darkRGBA[o] = darkRaw[i];
    darkRGBA[o + 1] = darkRaw[i + 1];
    darkRGBA[o + 2] = darkRaw[i + 2];
    darkRGBA[o + 3] = a;
  }
}

// Save automobi-logo.png and automobi-logo-dark.png
await sharp(lightRGBA, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: fullLeft, top: fullTop, width: fullWidth, height: fullHeight })
  .png({ compressionLevel: 9 })
  .toFile("public/brand/automobi-logo.png");

await sharp(darkRGBA, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: fullLeft, top: fullTop, width: fullWidth, height: fullHeight })
  .png({ compressionLevel: 9 })
  .toFile("public/brand/automobi-logo-dark.png");

// Extract mark (car + wrench only, from top down to the gap before text at y=304)
let markMinX = W, markMaxX = 0, markMinY = minY, markMaxY = 302;
for (let y = markMinY; y <= markMaxY; y++) {
  for (let x = 0; x < W; x++) {
    const a = alpha[y * W + x];
    if (a > 30) {
      if (x < markMinX) markMinX = x;
      if (x > markMaxX) markMaxX = x;
    }
  }
}

const markPad = 12;
const mLeft = Math.max(0, markMinX - markPad);
const mTop = Math.max(0, markMinY - markPad);
const mWidth = markMaxX - markMinX + 1 + markPad * 2;
const mHeight = markMaxY - markMinY + 1 + markPad * 2;

console.log('Mark crop:', { mLeft, mTop, mWidth, mHeight });

const markExtracted = await sharp(lightRGBA, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: mLeft, top: mTop, width: mWidth, height: mHeight })
  .png()
  .toBuffer();

const side = Math.max(mWidth, mHeight);
const squareMark = await sharp(markExtracted)
  .extend({
    top: Math.floor((side - mHeight) / 2),
    bottom: Math.ceil((side - mHeight) / 2),
    left: Math.floor((side - mWidth) / 2),
    right: Math.ceil((side - mWidth) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await sharp(squareMark)
  .resize(512, 512)
  .png({ compressionLevel: 9 })
  .toFile("public/brand/automobi-mark.png");

await sharp(squareMark)
  .resize(256, 256)
  .png({ compressionLevel: 9 })
  .toFile("src/app/icon.png");

console.log("All brand assets generated successfully!");

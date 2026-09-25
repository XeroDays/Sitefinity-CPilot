const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const OUT_ICO = path.resolve(__dirname, "../build/icon.ico");
const OUT_PNG = path.resolve(__dirname, "../build/icon.png");
const OUT_LOGO = path.resolve(__dirname, "../src/renderer/assets/logo.png");

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIZE = 512;

function markSvg(size) {
  const radius = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.52);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#0f1419"/>
  <rect x="${Math.round(size * 0.08)}" y="${Math.round(size * 0.08)}" width="${Math.round(size * 0.84)}" height="${Math.round(size * 0.84)}" rx="${Math.round(radius * 0.7)}" fill="none" stroke="#34d399" stroke-width="${Math.max(2, Math.round(size * 0.04))}"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#34d399">C</text>
</svg>`);
}

async function squarePng(size) {
  return sharp(markSvg(size)).png().toBuffer();
}

async function main() {
  const pngBuffers = await Promise.all(ICO_SIZES.map((size) => squarePng(size)));
  const ico = await pngToIco(pngBuffers);

  fs.mkdirSync(path.dirname(OUT_ICO), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_LOGO), { recursive: true });
  fs.writeFileSync(OUT_ICO, ico);
  fs.writeFileSync(OUT_PNG, await squarePng(PNG_SIZE));
  fs.writeFileSync(OUT_LOGO, await squarePng(256));

  console.log("[generate-windows-icon] Wrote icon.ico, icon.png, and renderer logo.png");
}

main().catch((error) => {
  console.error("[generate-windows-icon] Failed:", error.message);
  process.exit(1);
});

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const SOURCE_PNG = path.resolve(
  __dirname,
  "../resources/logo/sitefinity-cpilot.png"
);
const OUT_ICO = path.resolve(__dirname, "../build/icon.ico");
const OUT_PNG = path.resolve(__dirname, "../build/icon.png");
const OUT_LOGO = path.resolve(__dirname, "../src/renderer/assets/logo.png");

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIZE = 512;
const LOGO_SIZE = 256;

async function squarePng(size) {
  if (!fs.existsSync(SOURCE_PNG)) {
    throw new Error(`Source logo not found: ${SOURCE_PNG}`);
  }
  return sharp(SOURCE_PNG)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    })
    .png()
    .toBuffer();
}

async function main() {
  const pngBuffers = await Promise.all(ICO_SIZES.map((size) => squarePng(size)));
  const ico = await pngToIco(pngBuffers);

  fs.mkdirSync(path.dirname(OUT_ICO), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_LOGO), { recursive: true });
  fs.writeFileSync(OUT_ICO, ico);
  fs.writeFileSync(OUT_PNG, await squarePng(PNG_SIZE));
  fs.writeFileSync(OUT_LOGO, await squarePng(LOGO_SIZE));

  console.log(
    "[generate-windows-icon] Wrote icon.ico, icon.png, and renderer logo.png from",
    path.relative(path.resolve(__dirname, ".."), SOURCE_PNG)
  );
}

main().catch((error) => {
  console.error("[generate-windows-icon] Failed:", error.message);
  process.exit(1);
});

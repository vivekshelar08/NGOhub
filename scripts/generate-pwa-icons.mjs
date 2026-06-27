import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "public", "svitech-logo.png");
const outDir = join(root, "public", "icons");

/** Matches manifest background_color */
const BACKGROUND = "#f8fafb";

async function createIcon(size, logoScale) {
  const maxLogoWidth = Math.round(size * logoScale);
  const maxLogoHeight = Math.round(size * logoScale * 0.4);

  const logo = await sharp(source)
    .resize({ width: maxLogoWidth, height: maxLogoHeight, fit: "inside" })
    .toBuffer();

  const { width = 0, height = 0 } = await sharp(logo).metadata();
  const left = Math.round((size - width) / 2);
  const top = Math.round((size - height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();
}

mkdirSync(outDir, { recursive: true });

const [icon192, icon512, iconMaskable512] = await Promise.all([
  createIcon(192, 0.9),
  createIcon(512, 0.9),
  createIcon(512, 0.72),
]);

writeFileSync(join(outDir, "icon-192.png"), icon192);
writeFileSync(join(outDir, "icon-512.png"), icon512);
writeFileSync(join(outDir, "icon-maskable-512.png"), iconMaskable512);

console.log("Generated PWA icons from public/svitech-logo.png");

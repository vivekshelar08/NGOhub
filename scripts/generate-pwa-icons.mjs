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

async function loadEmblem() {
  const { height = 0 } = await sharp(source).metadata();
  return sharp(source)
    .extract({ left: 0, top: 0, width: height, height })
    .trim()
    .toBuffer();
}

async function createIcon(emblem, size, logoScale) {
  const maxLogoSize = Math.round(size * logoScale);

  const logo = await sharp(emblem)
    .resize({ width: maxLogoSize, height: maxLogoSize, fit: "inside" })
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

const emblem = await loadEmblem();

const [icon192, icon512, iconMaskable512, favicon32, apple180] = await Promise.all([
  createIcon(emblem, 192, 0.78),
  createIcon(emblem, 512, 0.78),
  createIcon(emblem, 512, 0.62),
  createIcon(emblem, 32, 0.82),
  createIcon(emblem, 180, 0.78),
]);

writeFileSync(join(outDir, "icon-192.png"), icon192);
writeFileSync(join(outDir, "icon-512.png"), icon512);
writeFileSync(join(outDir, "icon-maskable-512.png"), iconMaskable512);
writeFileSync(join(outDir, "favicon-32.png"), favicon32);

const appDir = join(root, "src", "app");
mkdirSync(appDir, { recursive: true });
writeFileSync(join(appDir, "icon.png"), favicon32);
writeFileSync(join(appDir, "apple-icon.png"), apple180);

console.log("Generated emblem-only PWA + favicon icons from public/svitech-logo.png");

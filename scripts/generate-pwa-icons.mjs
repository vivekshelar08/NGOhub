import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public", "svitech-logo.png");
const iconsDir = join(root, "public", "icons");
const appDir = join(root, "src", "app");

mkdirSync(iconsDir, { recursive: true });

const BRAND_TEAL = { r: 13, g: 93, b: 86, alpha: 1 };
const BRAND_MIST = { r: 240, g: 247, b: 246, alpha: 1 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function loadEmblem() {
  const meta = await sharp(logoPath).metadata();
  const emblemSize = meta.height ?? 183;

  return sharp(logoPath)
    .extract({
      left: 0,
      top: 0,
      width: Math.min(emblemSize, meta.width ?? emblemSize),
      height: emblemSize,
    })
    .png()
    .toBuffer();
}

async function loadWordmark() {
  return sharp(logoPath).png().toBuffer();
}

async function composeIcon(size, graphic, options) {
  const { background, paddingRatio, useWordmark = false } = options;
  const pad = Math.round(size * paddingRatio);
  const inner = size - pad * 2;

  const resized = useWordmark
    ? await sharp(graphic)
        .resize(inner, inner, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    : await sharp(graphic)
        .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  const emblem = await loadEmblem();
  const wordmark = await loadWordmark();

  const icon192 = await composeIcon(192, emblem, {
    background: WHITE,
    paddingRatio: 0.12,
  });
  const icon512 = await composeIcon(512, emblem, {
    background: WHITE,
    paddingRatio: 0.12,
  });
  const maskable512 = await composeIcon(512, emblem, {
    background: BRAND_TEAL,
    paddingRatio: 0.18,
  });
  const appleIcon = await composeIcon(180, emblem, {
    background: BRAND_MIST,
    paddingRatio: 0.14,
  });
  const appIcon = await composeIcon(256, emblem, {
    background: WHITE,
    paddingRatio: 0.12,
  });

  writeFileSync(join(iconsDir, "icon-192.png"), icon192);
  writeFileSync(join(iconsDir, "icon-512.png"), icon512);
  writeFileSync(join(iconsDir, "icon-maskable-512.png"), maskable512);
  writeFileSync(join(iconsDir, "icon-wordmark-512.png"), await composeIcon(512, wordmark, {
    background: WHITE,
    paddingRatio: 0.1,
    useWordmark: true,
  }));
  writeFileSync(join(appDir, "icon.png"), appIcon);
  writeFileSync(join(appDir, "apple-icon.png"), appleIcon);

  console.log("Generated PWA icons from public/svitech-logo.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

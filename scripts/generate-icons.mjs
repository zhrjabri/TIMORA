// Generates optimized SVG brand assets and PNG/ICO app icons from src/lib/brand/marks.ts.
// Run with: npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BRAND_COLORS as C, MARK_COMPACT, MARK_PRIMARY } from "../src/lib/brand/marks.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (...p) => join(root, ...p);

/** Mark group placed inside a square canvas of `size` units, scaled to `scale` of the canvas. */
function markGroup(geom, { ink, accent, size = 48, scale = 1 }) {
  const s = (size * scale) / 48;
  const offset = (size - 48 * s) / 2;
  const t = s === 1 && offset === 0 ? "" : ` transform="translate(${round(offset)} ${round(offset)}) scale(${round(s)})"`;
  return `<g${t}><path d="${geom.strokes}" fill="none" stroke="${ink}" stroke-width="${geom.strokeWidth}" stroke-linecap="round"/><path d="${geom.diamond}" fill="${accent}"/></g>`;
}

const round = (n) => Math.round(n * 1000) / 1000;

function svgMark(geom, colors) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img" aria-label="TIMORA">${markGroup(geom, colors)}</svg>\n`;
}

/** Square tile icon. `radius` is a fraction of the size (0 = full bleed). */
function svgTile(geom, { size, radius, scale }) {
  const r = round(size * radius);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="TIMORA"><rect width="${size}" height="${size}" rx="${r}" fill="${C.black}"/>${markGroup(geom, { ink: C.ivory, accent: C.gold, size, scale })}</svg>\n`;
}

async function png(svg, px, file) {
  await mkdir(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg), { density: 72 * (px / 48) * 2 })
    .resize(px, px)
    .png({ compressionLevel: 9 })
    .toFile(file);
}

/** Minimal ICO writer with embedded PNG images (supported by all modern browsers). */
async function ico(svg, sizes, file) {
  const images = await Promise.all(
    sizes.map((px) => sharp(Buffer.from(svg), { density: 72 * (px / 48) * 2 }).resize(px, px).png().toBuffer()),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  images.forEach((img, i) => {
    const e = Buffer.alloc(16);
    const px = sizes[i];
    e.writeUInt8(px >= 256 ? 0 : px, 0);
    e.writeUInt8(px >= 256 ? 0 : px, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(img.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.length;
    entries.push(e);
  });
  await writeFile(file, Buffer.concat([header, ...entries, ...images]));
}

async function main() {
  await mkdir(out("public", "brand"), { recursive: true });
  await mkdir(out("public", "icons"), { recursive: true });

  const variants = [
    ["timora-mark", MARK_PRIMARY],
    ["timora-compact", MARK_COMPACT],
  ];
  for (const [name, geom] of variants) {
    await writeFile(out("public", "brand", `${name}.svg`), svgMark(geom, { ink: C.black, accent: C.gold }));
    await writeFile(out("public", "brand", `${name}-reversed.svg`), svgMark(geom, { ink: C.ivory, accent: C.gold }));
    await writeFile(out("public", "brand", `${name}-mono-black.svg`), svgMark(geom, { ink: C.black, accent: C.black }));
    await writeFile(out("public", "brand", `${name}-mono-ivory.svg`), svgMark(geom, { ink: C.ivory, accent: C.ivory }));
  }

  // Favicon (SVG): compact mark on a rounded black tile.
  const favicon = svgTile(MARK_COMPACT, { size: 48, radius: 0.22, scale: 0.86 });
  await writeFile(out("src", "app", "icon.svg"), favicon);
  await writeFile(out("public", "brand", "timora-app-icon.svg"), svgTile(MARK_COMPACT, { size: 48, radius: 0.22, scale: 0.72 }));
  await ico(favicon, [16, 32, 48], out("src", "app", "favicon.ico"));

  // PWA icons: "any" (rounded tile) and "maskable" (full bleed, mark inside the 80% safe zone).
  const anyIcon = svgTile(MARK_COMPACT, { size: 48, radius: 0.22, scale: 0.72 });
  const maskable = svgTile(MARK_COMPACT, { size: 48, radius: 0, scale: 0.6 });
  await png(anyIcon, 192, out("public", "icons", "icon-192.png"));
  await png(anyIcon, 512, out("public", "icons", "icon-512.png"));
  await png(maskable, 192, out("public", "icons", "maskable-192.png"));
  await png(maskable, 512, out("public", "icons", "maskable-512.png"));
  // iOS applies its own corner mask, so the Apple icon is full bleed.
  await png(svgTile(MARK_COMPACT, { size: 48, radius: 0, scale: 0.68 }), 180, out("src", "app", "apple-icon.png"));

  console.log("Brand assets generated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

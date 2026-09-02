// Regenerates public/icons/*.png. Run with `npm run generate:icons`.
//
// These are placeholder brand-color icons (see docs/plan.md, "アイコンは
// 実際のロゴから生成する" note) — swap the SVGs below for real artwork
// before shipping past Phase 1a.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT_DIR = new URL("../public/icons", import.meta.url);
mkdirSync(OUT_DIR, { recursive: true });

const BG = "#4f46e5";
const FG = "#ffffff";

function standardSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="22" fill="${BG}"/>
    <rect x="24" y="30" width="52" height="10" rx="5" fill="${FG}"/>
    <rect x="24" y="45" width="52" height="10" rx="5" fill="${FG}"/>
    <rect x="24" y="60" width="34" height="10" rx="5" fill="${FG}"/>
  </svg>`;
}

// Kept inside the central 80% "safe zone" — OS masks may crop the outer
// ring on Android/iOS home screens.
function maskableSvg() {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${BG}"/>
    <rect x="30" y="38" width="40" height="8" rx="4" fill="${FG}"/>
    <rect x="30" y="50" width="40" height="8" rx="4" fill="${FG}"/>
    <rect x="30" y="62" width="26" height="8" rx="4" fill="${FG}"/>
  </svg>`;
}

async function render(svg, size, filename) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL(filename, `${OUT_DIR}/`));
  console.log(`wrote ${filename}`);
}

await render(standardSvg(), 192, "icon-192.png");
await render(standardSvg(), 512, "icon-512.png");
await render(maskableSvg(), 512, "icon-maskable-512.png");
await render(standardSvg(), 180, "apple-touch-icon.png");

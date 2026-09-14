// Preview generator — V3 (square, OpenSea-friendly).
// Black bg, no frame, $ZeroLAB SVG logo, white + green palette.
// Run: node scripts/preview-card-v3.mjs [tokenId] [suffix]
// Output: ./preview-card-v3[-suffix].png

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import TextToSVG from 'text-to-svg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const tokenId = parseInt(process.argv[2] || '18', 10);
const suffix = process.argv[3] ? `-${process.argv[3]}` : '';

// ---------- metadata ----------
const traits = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/labmetadata/traits.json'), 'utf8')
);
const tokenData = traits.traits.find((t) => t.tokenId === tokenId);
if (!tokenData) {
  console.error(`Token ${tokenId} not found`);
  process.exit(1);
}

const totalMinted = 7;
const maxSupply = tokenData.maxSupply || 100;

const rarityTiers = [
  { max: 1, tag: 'LEGENDARY', color: '#ff6b00' },
  { max: 5, tag: 'EPIC', color: '#9b59b6' },
  { max: 10, tag: 'RARE', color: '#3498db' },
  { max: 50, tag: 'UNCOMMON', color: '#2ecc71' },
  { max: 100, tag: 'COMMON', color: '#95a5a6' },
];
const rarity =
  rarityTiers.find((r) => maxSupply <= r.max) ||
  rarityTiers[rarityTiers.length - 1];

// ---------- fonts ----------
const tts = TextToSVG.loadSync(
  path.join(ROOT, 'public/fonts/retro/VT323-Regular.ttf')
);
const ttsPixel = TextToSVG.loadSync(
  path.join(ROOT, 'public/fonts/retro/PressStart2P-Regular.ttf')
);

function textPath(text, opts) {
  const t = opts.pixel ? ttsPixel : tts;
  const raw = t.getPath(text, {
    x: 0,
    y: 0,
    fontSize: opts.fontSize,
    anchor: opts.anchor || 'left top',
  });
  const m = raw.match(/d="([^"]+)"/);
  const d = m ? m[1] : '';
  return `<path d="${d}" fill="${opts.fill || '#000'}" transform="translate(${opts.x}, ${opts.y})"/>`;
}
function measureText(text, fontSize, pixel = false) {
  return (pixel ? ttsPixel : tts).getMetrics(text, { fontSize }).width;
}

// ---------- assets ----------
function svgToPngBase64(absPath, size) {
  const svg = fs.readFileSync(absPath);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}
function loadSvgInline(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  return raw
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<!DOCTYPE[^>]*>/i, '');
}

// ---------- palette ----------
const BLACK = '#000000';
const WHITE = '#ffffff';
const GREEN = '#95c11f';
const ACCENT = rarity.color;

// hero size — render at 720px wide to leave room for footer
const HS = 720;
const mannequinB64 = svgToPngBase64(
  path.join(ROOT, 'public/labimages/mannequin.svg'),
  HS
);
const traitB64 = svgToPngBase64(
  path.join(ROOT, `public/labimages/${tokenId}.svg`),
  HS
);

// ---------- geometry (square 1024×1024) ----------
const W = 1024;
const H = 1024;

const HX = (W - HS) / 2;       // 152
const HY = 64;
const HRIGHT = HX + HS;        // 872
const HBOT = HY + HS;          // 784

// title bar
const TX = HX;
const TW = HS;
const TY = HBOT + 24;          // 808
const TH = 72;

// stats row
const SX = HX;
const SW = HS;
const SY = TY + TH + 18;       // 898
const SH = 100;                 // 898-998

// ---------- helpers ----------
function rect(x, y, w, h, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

function rarityTagInside(x, y, w, h, label, fill, ink) {
  // notched corner like v1 but with subtle pixel notch
  return [
    rect(x, y, w, h, fill),
    textPath(label, {
      x: x + w / 2,
      y: y + h / 2 + 1,
      fontSize: 26,
      fill: ink,
      anchor: 'center middle',
      pixel: true,
    }),
  ].join('');
}

// ---------- $ZeroLAB logo (recoloured inline) ----------
const zeroLabSvg = loadSvgInline(
  path.join(ROOT, 'public/labimages/zerolab-dollar.svg')
);
// replace the green fill with same green to keep it explicit + allow easy tweak
function makeLogoSvg(color) {
  // the source uses .cls-2 class with fill #95c11f
  return zeroLabSvg.replace(/#95c11f/gi, color).replace(/fill:#95c11f/gi, `fill:${color}`);
}
const logoSvgGreen = makeLogoSvg(GREEN);
const logoPng = new Resvg(logoSvgGreen, { fitTo: { mode: 'width', value: 480 } })
  .render()
  .asPng();
const logoB64 = `data:image/png;base64,${logoPng.toString('base64')}`;

// ---------- composition ----------
const traitName = (tokenData.name || '').toUpperCase();
const labelLines = [
  { label: 'CATEGORY', value: tokenData.category },
  { label: 'TOTAL MINTED', value: String(totalMinted) },
  { label: 'FLOPPY', value: tokenData.floppy || 'OG' },
];

// rarity tag dimensions
const RARITY_FONT = 26;
const rarityTextW = measureText(rarity.tag, RARITY_FONT, true);
const rarityTagW = Math.max(rarityTextW + 36, 160);
const rarityTagH = 48;
const RTX = HX + 24;
const RTY = HY + 24;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- card bg: pure black, no frame -->
  ${rect(0, 0, W, H, BLACK)}

  <!-- thin pixel border (subtle, green) -->
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${GREEN}" stroke-width="2" opacity="0.35"/>

  <!-- HERO panel — v1 style: white bg + rarity tint -->
  ${rect(HX, HY, HS, HS, WHITE)}
  ${rect(HX, HY, HS, HS, ACCENT)}
  <rect x="${HX}" y="${HY}" width="${HS}" height="${HS}" fill="${WHITE}" opacity="0.78"/>
  <image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${mannequinB64}"/>
  <image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${traitB64}"/>

  <!-- rarity tag inside hero (top-left) -->
  ${rarityTagInside(RTX, RTY, rarityTagW, rarityTagH, rarity.tag, ACCENT, WHITE)}

  <!-- title banner (trait name) — green band, white text, white pixel borders top/bottom -->
  ${rect(TX, TY, TW, TH, GREEN)}
  ${rect(TX, TY, TW, 3, WHITE)}
  ${rect(TX, TY + TH - 3, TW, 3, WHITE)}
  ${textPath(traitName, {
    x: TX + TW / 2,
    y: TY + TH / 2 + 4,
    fontSize: 54,
    fill: WHITE,
    anchor: 'center middle',
  })}

  <!-- stats row: 3 lines on the left, $ZeroLAB logo on the right -->
  ${(() => {
    const lineH = 30;
    const startY = SY + 4;
    const left = SX + 4;
    const lines = labelLines
      .map((row, i) => {
        const y = startY + i * lineH;
        const labelEl = textPath(`${row.label}:`, {
          x: left,
          y,
          fontSize: 22,
          fill: GREEN,
          anchor: 'left top',
        });
        const labelW = measureText(`${row.label}: `, 22);
        const valueEl = textPath(row.value, {
          x: left + labelW,
          y,
          fontSize: 22,
          fill: WHITE,
          anchor: 'left top',
        });
        return labelEl + valueEl;
      })
      .join('');

    // logo on the right, centered vertically across the stats block
    const logoMaxW = 320;
    const logoMaxH = SH - 8;
    const ratio = 454.74 / 99.2;
    let logoW = logoMaxW;
    let logoH = logoW / ratio;
    if (logoH > logoMaxH) {
      logoH = logoMaxH;
      logoW = logoH * ratio;
    }
    const logoX = SX + SW - logoW - 4;
    const logoY = SY + (SH - logoH) / 2;
    const logoEl = `<image x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" href="${logoB64}"/>`;

    return lines + logoEl;
  })()}
</svg>`;

// ---------- render ----------
fs.writeFileSync(path.join(ROOT, `preview-card-v3${suffix}.svg`), svg);
const pngOut = new Resvg(svg, { fitTo: { mode: 'width', value: W } })
  .render()
  .asPng();
const outPath = path.join(ROOT, `preview-card-v3${suffix}.png`);
fs.writeFileSync(outPath, pngOut);
console.log(
  `✓ ${outPath}  | ${tokenData.name} | ${rarity.tag} | ${tokenData.category} | ${tokenData.floppy || 'OG'}`
);

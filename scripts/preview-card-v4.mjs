// Preview generator — V4 (Gemini look, portrait 1024×1280).
// Black bg, [ZEROLAB] header on top, hero with corner brackets + dot grid,
// yellow-lime title banner, 2-col stats grid, creator-ref footer.
// Run: node scripts/preview-card-v4.mjs [tokenId] [suffix]
// Output: ./preview-card-v4[-suffix].png

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import TextToSVG from 'text-to-svg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const tokenId = parseInt(process.argv[2] || '18', 10);
const modeArg = process.argv[3] || '';
const rarityStyle = (process.argv[4] || '').toLowerCase(); // '' | 'a' | 'b' | 'c'
const suffixParts = [modeArg, rarityStyle].filter(Boolean).map((s) => `-${s}`);
const suffix = suffixParts.join('');
const LIGHT_HERO = modeArg === 'light';

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

// ---------- rarity ----------
const rarityTiers = [
  { max: 1, tag: 'LEGENDARY', color: '#ff6b00' },
  { max: 5, tag: 'EPIC',      color: '#9b59b6' },
  { max: 10, tag: 'RARE',     color: '#3498db' },
  { max: 50, tag: 'UNCOMMON', color: '#2ecc71' },
  { max: 100, tag: 'COMMON',  color: '#95a5a6' },
];
const _maxSupply = tokenData.maxSupply || 100;
const rarity =
  rarityTiers.find((r) => _maxSupply <= r.max) ||
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
const LIME = '#c9f227';      // yellow-lime (Gemini banner + accents)
const LIME_DIM = '#7a9418';  // dim version for dot grid
const GREEN = '#95c11f';     // original logo green
const ACCENT_FOOT = '#9aa3ad';

// ---------- $ZeroLAB logo (recoloured to LIME) ----------
const zeroLabSvg = loadSvgInline(
  path.join(ROOT, 'public/labimages/zerolab-dollar.svg')
);
function makeLogoSvg(color) {
  return zeroLabSvg
    .replace(/#95c11f/gi, color)
    .replace(/fill:#95c11f/gi, `fill:${color}`);
}
const logoB64 = (() => {
  const svg = makeLogoSvg(LIME);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 720 } })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
})();

// ---------- geometry (portrait 1024×1400) ----------
const W = 1024;
const H = 1400;

// header logo
const LOGO_W = 720;
const LOGO_RATIO = 454.74 / 99.2;
const LOGO_H = LOGO_W / LOGO_RATIO; // ~157
const LOGO_X = (W - LOGO_W) / 2;
const LOGO_Y = 56;

// hero
const HS = 800;
const HX = (W - HS) / 2; // 112
const HY = LOGO_Y + LOGO_H + 56; // ~269
const HBOT = HY + HS;

// hero brackets (corner brackets, drawn outside hero edge by a few px)
const BRK_LEN = 56;
const BRK_W = 6;
const BRK_PAD = 14;

// title banner (yellow-lime)
const BAN_W = HS;
const BAN_H = 84;
const BAN_X = HX;
const BAN_Y = HBOT + 28;

// stats grid (2 cols × 3 rows)
const ST_X = HX + 8;
const ST_Y = BAN_Y + BAN_H + 36;
const ST_COL_W = (HS - 16) / 2;
const ST_ROW_H = 38;
const ST_FONT = 24;

// footer
const FOOT_Y = ST_Y + ST_ROW_H * 3 + 28;

// ---------- hero render ----------
const mannequinB64 = svgToPngBase64(
  path.join(ROOT, 'public/labimages/mannequin.svg'),
  HS
);
const traitB64 = svgToPngBase64(
  path.join(ROOT, `public/labimages/${tokenId}.svg`),
  HS
);

// ---------- helpers ----------
function rect(x, y, w, h, fill, opts = {}) {
  const opacity = opts.opacity != null ? ` opacity="${opts.opacity}"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity}/>`;
}

function cornerBracket(cx, cy, dx, dy) {
  // dx/dy ∈ {-1, +1} — direction the bracket opens
  // Two strokes meeting at (cx, cy), each BRK_LEN long, BRK_W thick.
  const horiz = `<rect x="${dx === 1 ? cx : cx - BRK_LEN}" y="${cy - BRK_W / 2}" width="${BRK_LEN}" height="${BRK_W}" fill="${LIME}"/>`;
  const vert = `<rect x="${cx - BRK_W / 2}" y="${dy === 1 ? cy : cy - BRK_LEN}" width="${BRK_W}" height="${BRK_LEN}" fill="${LIME}"/>`;
  return horiz + vert;
}

// dot grid pattern inside hero (subtle)
const HERO_BG = LIGHT_HERO ? '#f1efe4' : BLACK;        // off-white cream when light
const DOT_COLOR =
  rarityStyle === 'b'
    ? rarity.color
    : LIGHT_HERO ? '#7a9418' : LIME_DIM;
const DOT_OPACITY =
  rarityStyle === 'b' ? 0.45 : (LIGHT_HERO ? 0.35 : 0.55);
function dotGridDef() {
  return `
    <pattern id="dotgrid" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="${DOT_COLOR}" opacity="${DOT_OPACITY}"/>
    </pattern>
  `;
}

// ---------- composition ----------
const traitName = (tokenData.name || '').toUpperCase();

// stats fields (mirror Gemini layout: left col then right col, top→bottom)
const creatorName = 'TIGER+ADRIAN';
const seriesLabel = (tokenData.floppy || 'OG').toUpperCase();
const assetId = `#${String(tokenId).padStart(5, '0')}`;

const statFields = [
  // left col rows
  { col: 0, row: 0, label: 'CATEGORY',     value: (tokenData.category || '').toUpperCase() },
  { col: 0, row: 1, label: 'TOTAL MINTED', value: String(totalMinted) },
  { col: 0, row: 2, label: 'SERIES',       value: seriesLabel },
  // right col rows
  { col: 1, row: 0, label: 'CREATOR',      value: creatorName },
  { col: 1, row: 1, label: 'BLOCKCHAIN',   value: 'BASE' },
  { col: 1, row: 2, label: 'ASSET ID',     value: assetId },
];

const footerText = `> ZEROLAB ASSET // BE REAL | BE $ZERO`;

// banner title font sizing — fit width
function fitFontSize(text, maxW, baseSize, pixel = true) {
  let size = baseSize;
  while (size > 16) {
    const w = measureText(text, size, pixel);
    if (w <= maxW) return size;
    size -= 2;
  }
  return size;
}
const BAN_INNER_PAD = 28;
const BAN_FONT = fitFontSize(traitName, BAN_W - BAN_INNER_PAD * 2, 44, true);

// ---------- SVG ----------
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${dotGridDef()}
  </defs>

  <!-- card background: pure black -->
  ${rect(0, 0, W, H, BLACK)}

  <!-- subtle frame (lime, very dim) -->
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${LIME}" stroke-width="2" opacity="0.18"/>

  <!-- HEADER LOGO [ZEROLAB] (lime) -->
  <image x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_W}" height="${LOGO_H}" href="${logoB64}"/>

  <!-- HERO panel: bg + dot grid -->
  ${rect(HX, HY, HS, HS, HERO_BG)}
  <rect x="${HX}" y="${HY}" width="${HS}" height="${HS}" fill="url(#dotgrid)"/>

  <!-- (c) rarity strip — left edge of hero -->
  ${rarityStyle === 'c' ? rect(HX, HY, 8, HS, rarity.color) : ''}

  <!-- mannequin + trait centered in hero -->
  <image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${mannequinB64}"/>
  <image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${traitB64}"/>

  <!-- corner brackets (lime) — 4 corners with small outward pad -->
  ${cornerBracket(HX - BRK_PAD,         HY - BRK_PAD,         +1, +1)}
  ${cornerBracket(HX + HS + BRK_PAD,    HY - BRK_PAD,         -1, +1)}
  ${cornerBracket(HX - BRK_PAD,         HY + HS + BRK_PAD,    +1, -1)}
  ${cornerBracket(HX + HS + BRK_PAD,    HY + HS + BRK_PAD,    -1, -1)}

  <!-- (a) rarity badge — top-right inside hero -->
  ${(() => {
    if (rarityStyle !== 'a') return '';
    const BADGE_FONT = 22;
    const BADGE_PAD_X = 14;
    const BADGE_PAD_Y = 14;
    const BADGE_TEXT_W = measureText(rarity.tag, BADGE_FONT, true);
    const BADGE_W = BADGE_TEXT_W + 28;
    const BADGE_H = 38;
    const BADGE_X = HX + HS - BADGE_PAD_X - BADGE_W;
    const BADGE_Y = HY + BADGE_PAD_Y;
    return [
      rect(BADGE_X, BADGE_Y, BADGE_W, BADGE_H, rarity.color),
      textPath(rarity.tag, {
        x: BADGE_X + BADGE_W / 2,
        y: BADGE_Y + BADGE_H / 2 + 1,
        fontSize: BADGE_FONT,
        fill: WHITE,
        anchor: 'center middle',
        pixel: true,
      }),
    ].join('');
  })()}

  <!-- TITLE BANNER (yellow-lime, pixel font black) -->
  ${rect(BAN_X, BAN_Y, BAN_W, BAN_H, LIME)}
  ${textPath(traitName, {
    x: BAN_X + BAN_W / 2,
    y: BAN_Y + BAN_H / 2 + 4,
    fontSize: BAN_FONT,
    fill: BLACK,
    anchor: 'center middle',
    pixel: true,
  })}

  <!-- STATS GRID (2 cols × 3 rows) -->
  ${statFields
    .map((f) => {
      const x = ST_X + f.col * ST_COL_W;
      const y = ST_Y + f.row * ST_ROW_H;
      const arrowGap = 22;
      const arrow = textPath('>', {
        x,
        y,
        fontSize: ST_FONT,
        fill: LIME,
        anchor: 'left top',
      });
      const label = textPath(`${f.label}:`, {
        x: x + arrowGap,
        y,
        fontSize: ST_FONT,
        fill: LIME,
        anchor: 'left top',
      });
      const labelW = measureText(`${f.label}: `, ST_FONT) + arrowGap + 8;
      const value = textPath(f.value, {
        x: x + labelW,
        y,
        fontSize: ST_FONT,
        fill: WHITE,
        anchor: 'left top',
      });
      return arrow + label + value;
    })
    .join('\n  ')}

  <!-- FOOTER creator ref (centered, dim) -->
  ${textPath(footerText, {
    x: W / 2,
    y: FOOT_Y,
    fontSize: 18,
    fill: ACCENT_FOOT,
    anchor: 'center top',
  })}
</svg>`;

// ---------- render ----------
fs.writeFileSync(path.join(ROOT, `preview-card-v4${suffix}.svg`), svg);
const pngOut = new Resvg(svg, { fitTo: { mode: 'width', value: W } })
  .render()
  .asPng();
const outPath = path.join(ROOT, `preview-card-v4${suffix}.png`);
fs.writeFileSync(outPath, pngOut);
console.log(
  `✓ ${outPath}  | ${tokenData.name} | ${tokenData.category} | ${seriesLabel} | ${assetId}`
);

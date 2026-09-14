// Preview generator for the redesigned trait card.
// Run: node scripts/preview-card-v2.mjs [tokenId]
// Output: ./preview-card-v2.png

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import TextToSVG from 'text-to-svg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const tokenId = parseInt(process.argv[2] || '18', 10);

// ---------- load metadata ----------
const traits = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/labmetadata/traits.json'), 'utf8')
);
const tokenData = traits.traits.find((t) => t.tokenId === tokenId);
if (!tokenData) {
  console.error(`Token ${tokenId} not found in traits.json`);
  process.exit(1);
}

// fake on-chain stat for preview
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

function getInstance(opts) {
  return opts.pixel ? ttsPixel : tts;
}

function textPath(text, opts) {
  const t = getInstance(opts);
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
  const t = pixel ? ttsPixel : tts;
  return t.getMetrics(text, { fontSize }).width;
}

// ---------- assets ----------
function svgToPngBase64(absPath, size) {
  const svg = fs.readFileSync(absPath);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}
function loadImageBase64(absPath, mime) {
  const buf = fs.readFileSync(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const mannequinB64 = svgToPngBase64(
  path.join(ROOT, 'public/labimages/mannequin.svg'),
  600
);
const traitB64 = svgToPngBase64(
  path.join(ROOT, `public/labimages/${tokenId}.svg`),
  600
);
const zeroLabB64 = loadImageBase64(
  path.join(ROOT, 'public/labimages/zerolab.png'),
  'image/png'
);

// ---------- card geometry (centered & coherent) ----------
const W = 768;
const H = 1024;

const cardBg = '#ece4d3';
const ink = '#1a1a1a';
const accent = rarity.color;

// hero
const HS = 600;
const HX = (W - HS) / 2;            // 84
const HY = 188;                       // a bit lower to fit two top rows
const HRIGHT = HX + HS;              // 684

// row 1 (big pills #ID + RARITY)
const PILL_H = 54;
const PILL_FONT = 36;
const PILL_PAD_X = 24;
const PILL_Y = 76;                    // 76-130

// row 2 (chips CATEGORY + FLOPPY)
const CHIP_H = 32;
const CHIP_FONT = 22;
const CHIP_PAD_X = 16;
const CHIP_Y = PILL_Y + PILL_H + 14;  // 144-176

// title bar (below hero, same width as hero)
const TX = HX;
const TW = HS;
const TY = HY + HS + 20;             // 808
const TH = 74;

// stats footer (below title, same width as hero)
const SX = HX;
const SW = HS;
const SY = TY + TH + 12;             // 894
const SH = 112;                       // 894-1006

// ---------- shape helpers ----------
function notched(x, y, w, h, n, fill, stroke = null, sw = 0) {
  const d = `
    M ${x + n} ${y}
    L ${x + w - n} ${y}
    L ${x + w} ${y + n}
    L ${x + w} ${y + h - n}
    L ${x + w - n} ${y + h}
    L ${x + n} ${y + h}
    L ${x} ${y + h - n}
    L ${x} ${y + n}
    Z`;
  const strokeAttr = stroke
    ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="miter"`
    : '';
  return `<path d="${d}" fill="${fill}"${strokeAttr}/>`;
}

function pixelGrid(x, y, w, h, color, step = 12, opacity = 0.18) {
  let dots = '';
  for (let i = 0; i < w; i += step) {
    for (let j = 0; j < h; j += step) {
      dots += `<rect x="${x + i}" y="${y + j}" width="1" height="1" fill="${color}" opacity="${opacity}"/>`;
    }
  }
  return dots;
}

function pixelBar(x, y, w, h, pct, fillColor, bgColor, ink) {
  const cells = 22;
  const cellW = (w - cells - 1) / cells;
  const filled = Math.round(pct * cells);
  let out = `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" fill="${ink}"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgColor}"/>`;
  for (let i = 0; i < cells; i++) {
    const cx = x + 1 + i * (cellW + 1);
    out += `<rect x="${cx}" y="${y + 1}" width="${cellW}" height="${h - 2}" fill="${i < filled ? fillColor : 'transparent'}"/>`;
  }
  return out;
}

// matched pill (used for #ID and RARITY)
function pill({ x, y, w, h, fill, ink, text, textColor, fontSize }) {
  const out = [
    notched(x, y, w, h, 6, ink),
    notched(x + 3, y + 3, w - 6, h - 6, 5, fill),
    textPath(text, {
      x: x + w / 2,
      y: y + h / 2 + fontSize * 0.05,
      fontSize,
      fill: textColor,
      anchor: 'center middle',
    }),
  ];
  return out.join('');
}

// smaller chip (CATEGORY / FLOPPY) — simple bordered tag
function chip({ x, y, w, h, fill, ink, text, textColor, fontSize }) {
  const border = 2;
  return [
    `<rect x="${x - border}" y="${y - border}" width="${w + border * 2}" height="${h + border * 2}" fill="${ink}"/>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`,
    textPath(text, {
      x: x + w / 2,
      y: y + h / 2 + fontSize * 0.05,
      fontSize,
      fill: textColor,
      anchor: 'center middle',
    }),
  ].join('');
}

// ---------- pill / chip sizing ----------
const idText = `#${String(tokenId).padStart(3, '0')}`;
const idPillW = Math.max(measureText(idText, PILL_FONT) + PILL_PAD_X * 2, 140);

const rarityText = rarity.tag;
const rarityPillW = Math.max(measureText(rarityText, PILL_FONT) + PILL_PAD_X * 2, 140);

const categoryText = (tokenData.category || '').toUpperCase();
const floppyText = (tokenData.floppy || 'OG').toUpperCase();
const categoryChipW = Math.max(
  measureText(categoryText, CHIP_FONT, true) + CHIP_PAD_X * 2,
  100
);
const floppyChipW = Math.max(
  measureText(floppyText, CHIP_FONT, true) + CHIP_PAD_X * 2,
  100
);
// fallback to VT323 if pixel-font width would overflow hero
let useCategoryPixel = true;
let useFloppyPixel = true;
if (categoryChipW > HS / 2 - 20) {
  useCategoryPixel = false;
}
if (floppyChipW > HS / 2 - 20) {
  useFloppyPixel = false;
}
const categoryChipWFinal = useCategoryPixel
  ? categoryChipW
  : Math.max(measureText(categoryText, CHIP_FONT) + CHIP_PAD_X * 2, 100);
const floppyChipWFinal = useFloppyPixel
  ? floppyChipW
  : Math.max(measureText(floppyText, CHIP_FONT) + CHIP_PAD_X * 2, 100);

// ---------- compose SVG ----------
const traitName = (tokenData.name || 'UNKNOWN').toUpperCase();

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">

  <!-- card stock -->
  ${notched(0, 0, W, H, 14, ink)}
  ${notched(8, 8, W - 16, H - 16, 12, cardBg)}

  <!-- subtle dot grid background on the whole card stock -->
  ${pixelGrid(20, 20, W - 40, H - 40, ink, 14, 0.16)}

  <!-- top accent stripe (rarity colored) -->
  <rect x="20" y="20" width="${W - 40}" height="44" fill="${accent}"/>
  <rect x="20" y="20" width="${W - 40}" height="5" fill="${ink}"/>
  <rect x="20" y="59" width="${W - 40}" height="5" fill="${ink}"/>

  <!-- ID pill (left, aligned to hero left edge) -->
  ${pill({
    x: HX,
    y: PILL_Y,
    w: idPillW,
    h: PILL_H,
    fill: cardBg,
    ink,
    text: idText,
    textColor: ink,
    fontSize: PILL_FONT,
  })}

  <!-- Rarity pill (right, aligned to hero right edge) -->
  ${pill({
    x: HRIGHT - rarityPillW,
    y: PILL_Y,
    w: rarityPillW,
    h: PILL_H,
    fill: accent,
    ink,
    text: rarityText,
    textColor: '#ffffff',
    fontSize: PILL_FONT,
  })}

  <!-- Row 2: CATEGORY chip (left, hero left edge) -->
  ${chip({
    x: HX,
    y: CHIP_Y,
    w: categoryChipWFinal,
    h: CHIP_H,
    fill: ink,
    ink,
    text: categoryText,
    textColor: '#ffffff',
    fontSize: useCategoryPixel ? CHIP_FONT - 4 : CHIP_FONT,
  })}

  <!-- Row 2: FLOPPY chip (right, hero right edge) -->
  ${chip({
    x: HRIGHT - floppyChipWFinal,
    y: CHIP_Y,
    w: floppyChipWFinal,
    h: CHIP_H,
    fill: ink,
    ink,
    text: floppyText,
    textColor: '#ffffff',
    fontSize: useFloppyPixel ? CHIP_FONT - 4 : CHIP_FONT,
  })}

  <!-- HERO panel (v1 style: white bg + rarity tint, no internal tag) -->
  ${notched(HX - 5, HY - 5, HS + 10, HS + 10, 8, ink)}
  <rect x="${HX}" y="${HY}" width="${HS}" height="${HS}" fill="#ffffff"/>
  <rect x="${HX}" y="${HY}" width="${HS}" height="${HS}" fill="${accent}" opacity="0.13"/>
  <image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${mannequinB64}"/>
  <image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${traitB64}"/>

  <!-- TITLE bar (same width as hero) -->
  ${notched(TX, TY, TW, TH, 8, ink)}
  ${notched(TX + 4, TY + 4, TW - 8, TH - 8, 6, cardBg)}
  ${textPath(traitName, {
    x: TX + TW / 2,
    y: TY + TH / 2 + 4,
    fontSize: 58,
    fill: ink,
    anchor: 'center middle',
  })}

  <!-- STATS footer — 2 columns: MINTED (left) + LOGO (right) -->
  ${notched(SX, SY, SW, SH, 6, ink)}
  ${notched(SX + 3, SY + 3, SW - 6, SH - 6, 4, cardBg)}

  ${(() => {
    const splitX = SX + Math.round(SW * 0.42); // minted col = 42%, logo col = 58%
    const padL = 22;
    const labelY = SY + 22;
    const valueY = SY + 50;
    const barY = SY + 88;

    const sepEl = `<rect x="${splitX}" y="${SY + 14}" width="2" height="${SH - 28}" fill="${ink}" opacity="0.18"/>`;

    // left: minted column with bar
    const c1 = [
      textPath('MINTED', { x: SX + padL, y: labelY, fontSize: 13, fill: ink, pixel: true }),
      textPath(`${totalMinted} / ${maxSupply}`, {
        x: SX + padL,
        y: valueY,
        fontSize: 32,
        fill: ink,
      }),
      pixelBar(
        SX + padL,
        barY,
        splitX - SX - padL - 22,
        12,
        Math.min(1, totalMinted / maxSupply),
        accent,
        cardBg,
        ink
      ),
    ].join('');

    // right: zerolab logo centered in remaining column
    const logoColW = SX + SW - splitX;
    const logoMaxW = logoColW - 32;
    const logoMaxH = SH - 28;
    // keep aspect ratio of the source (~3.27:1)
    const ratio = 459 / 140;
    let logoW = logoMaxW;
    let logoH = logoW / ratio;
    if (logoH > logoMaxH) {
      logoH = logoMaxH;
      logoW = logoH * ratio;
    }
    const logoX = splitX + (logoColW - logoW) / 2;
    const logoY = SY + (SH - logoH) / 2;
    const c2 = `<image x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" href="${zeroLabB64}"/>`;

    return sepEl + c1 + c2;
  })()}
</svg>`;

// ---------- render ----------
const suffix = process.argv[3] ? `-${process.argv[3]}` : '';
const out = new Resvg(svg, { fitTo: { mode: 'width', value: W } })
  .render()
  .asPng();
const outPath = path.join(ROOT, `preview-card-v2${suffix}.png`);
fs.writeFileSync(outPath, out);
console.log(`✓ ${outPath}  | ${tokenData.name} | ${rarity.tag} | ${tokenData.category} | ${tokenData.floppy || 'OG'}`);

// Shared v4 card renderer (Gemini-style).
// Used by both /api/render/floppy-v4/[id] and the main /api/render/floppy/[id]
// after swap. Pure render — no caching, no on-chain calls. Caller passes data.

import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import TextToSVG from 'text-to-svg';

let _ttsRetro = null;
let _ttsPixel = null;
let _logoB64 = null;
let _mannequinB64 = null;

function getFonts() {
  if (!_ttsRetro) {
    const ROOT = process.cwd();
    _ttsRetro = TextToSVG.loadSync(
      path.join(ROOT, 'public/fonts/retro/VT323-Regular.ttf')
    );
    _ttsPixel = TextToSVG.loadSync(
      path.join(ROOT, 'public/fonts/retro/PressStart2P-Regular.ttf')
    );
  }
  return { tts: _ttsRetro, ttsPixel: _ttsPixel };
}

function textPath(text, opts) {
  const { tts, ttsPixel } = getFonts();
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
  const { tts, ttsPixel } = getFonts();
  return (pixel ? ttsPixel : tts).getMetrics(text, { fontSize }).width;
}

function svgFileToPngBase64(absPath, size) {
  if (!fs.existsSync(absPath)) return null;
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

// ---------- palette + geometry (constants) ----------
export const V4_W = 1024;
export const V4_H = 1400;
export const V4_HS = 800;
export const V4_HX = (V4_W - V4_HS) / 2;
const BLACK = '#000000';
const WHITE = '#ffffff';
const LIME = '#c9f227';
const HERO_BG = '#f1efe4';
const DOT_COLOR = '#7a9418';
const FOOT_GRAY = '#9aa3ad';

const RARITY_TIERS = [
  { max: 1,   tag: 'LEGENDARY', color: '#ff6b00' },
  { max: 5,   tag: 'EPIC',      color: '#9b59b6' },
  { max: 10,  tag: 'RARE',      color: '#3498db' },
  { max: 50,  tag: 'UNCOMMON',  color: '#2ecc71' },
  { max: 100, tag: 'COMMON',    color: '#95a5a6' },
];

export function getRarityForToken(tokenData) {
  const maxSupply = tokenData?.maxSupply || 100;
  // High-supply traits (>100) get no badge — matches legacy FloppyRenderer behavior
  if (maxSupply > 100) return null;
  return (
    RARITY_TIERS.find((r) => maxSupply <= r.max) ||
    RARITY_TIERS[RARITY_TIERS.length - 1]
  );
}

// ---------- logo (recoloured to LIME) — cached ----------
function getLogoB64() {
  if (_logoB64) return _logoB64;
  const ROOT = process.cwd();
  const zeroLabSvg = loadSvgInline(
    path.join(ROOT, 'public/labimages/zerolab-dollar.svg')
  );
  const logoSvg = zeroLabSvg
    .replace(/#95c11f/gi, LIME)
    .replace(/fill:#95c11f/gi, `fill:${LIME}`);
  const png = new Resvg(logoSvg, { fitTo: { mode: 'width', value: 720 } })
    .render()
    .asPng();
  _logoB64 = `data:image/png;base64,${png.toString('base64')}`;
  return _logoB64;
}

function getMannequinB64() {
  if (_mannequinB64) return _mannequinB64;
  const ROOT = process.cwd();
  _mannequinB64 = svgFileToPngBase64(
    path.join(ROOT, 'public/labimages/mannequin.svg'),
    V4_HS
  );
  return _mannequinB64;
}

function getTraitB64ForId(tokenIdNum) {
  const ROOT = process.cwd();
  return svgFileToPngBase64(
    path.join(ROOT, `public/labimages/${tokenIdNum}.svg`),
    V4_HS
  );
}

/**
 * Build the v4 card SVG.
 * @param {Object} args
 * @param {number} args.tokenIdNum
 * @param {Object} args.tokenData       — name, category, floppy, maxSupply
 * @param {number} args.totalMinted
 * @param {string} [args.traitB64Override] — pass a custom trait image (used for animated GIF frames)
 * @returns {string} svg
 */
export function buildV4CardSvg({ tokenIdNum, tokenData, totalMinted, traitB64Override }) {
  const W = V4_W;
  const H = V4_H;
  const HS = V4_HS;
  const HX = V4_HX;

  const LOGO_W = 720;
  const LOGO_RATIO = 454.74 / 99.2;
  const LOGO_H = LOGO_W / LOGO_RATIO;
  const LOGO_X = (W - LOGO_W) / 2;
  const LOGO_Y = 56;
  const HY = LOGO_Y + LOGO_H + 56;
  const HBOT = HY + HS;
  const BRK_LEN = 56;
  const BRK_W = 6;
  const BRK_PAD = 14;
  const BAN_W = HS;
  const BAN_H = 84;
  const BAN_X = HX;
  const BAN_Y = HBOT + 28;
  const ST_X = HX + 8;
  const ST_Y = BAN_Y + BAN_H + 36;
  const ST_COL_W = (HS - 16) / 2;
  const ST_ROW_H = 38;
  const ST_FONT = 24;
  const FOOT_Y = ST_Y + ST_ROW_H * 3 + 28;

  const rarity = getRarityForToken(tokenData);
  const logoB64 = getLogoB64();
  const mannequinB64 = getMannequinB64();
  const traitB64 = traitB64Override || getTraitB64ForId(tokenIdNum);

  const rect = (x, y, w, h, fill, opacity) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`;

  const cornerBracket = (cx, cy, dx, dy) => {
    const horiz = `<rect x="${dx === 1 ? cx : cx - BRK_LEN}" y="${cy - BRK_W / 2}" width="${BRK_LEN}" height="${BRK_W}" fill="${LIME}"/>`;
    const vert = `<rect x="${cx - BRK_W / 2}" y="${dy === 1 ? cy : cy - BRK_LEN}" width="${BRK_W}" height="${BRK_LEN}" fill="${LIME}"/>`;
    return horiz + vert;
  };

  const traitName = (tokenData?.name || `TOKEN ${tokenIdNum}`).toUpperCase();
  const creatorName = 'TIGER+ADRIAN';
  const seriesLabel = (tokenData?.floppy || 'OG').toUpperCase();
  const assetId = `#${String(tokenIdNum).padStart(5, '0')}`;
  const statFields = [
    { col: 0, row: 0, label: 'CATEGORY',     value: (tokenData?.category || '').toUpperCase() },
    { col: 0, row: 1, label: 'TOTAL MINTED', value: String(totalMinted) },
    { col: 0, row: 2, label: 'SERIES',       value: seriesLabel },
    { col: 1, row: 0, label: 'CREATOR',      value: creatorName },
    { col: 1, row: 1, label: 'BLOCKCHAIN',   value: 'BASE' },
    { col: 1, row: 2, label: 'ASSET ID',     value: assetId },
  ];
  const footerText = `> ZEROLAB ASSET // BE REAL | BE $ZERO`;

  const BAN_INNER_PAD = 28;
  let BAN_FONT = 44;
  while (BAN_FONT > 16 && measureText(traitName, BAN_FONT, true) > BAN_W - BAN_INNER_PAD * 2) {
    BAN_FONT -= 2;
  }

  const BADGE_FONT = 22;
  const showBadge = rarity != null;
  const BADGE_TEXT_W = showBadge ? measureText(rarity.tag, BADGE_FONT, true) : 0;
  const BADGE_W = showBadge ? BADGE_TEXT_W + 28 : 0;
  const BADGE_H = 38;
  const BADGE_X = HX + HS - 14 - BADGE_W;
  const BADGE_Y = HY + 14;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="dotgrid" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="${DOT_COLOR}" opacity="0.35"/>
    </pattern>
  </defs>
  ${rect(0, 0, W, H, BLACK)}
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${LIME}" stroke-width="2" opacity="0.18"/>
  <image x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_W}" height="${LOGO_H}" href="${logoB64}"/>
  ${rect(HX, HY, HS, HS, HERO_BG)}
  <rect x="${HX}" y="${HY}" width="${HS}" height="${HS}" fill="url(#dotgrid)"/>
  ${mannequinB64 ? `<image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${mannequinB64}"/>` : ''}
  ${traitB64 ? `<image x="${HX}" y="${HY}" width="${HS}" height="${HS}" href="${traitB64}"/>` : ''}
  ${cornerBracket(HX - BRK_PAD,      HY - BRK_PAD,      +1, +1)}
  ${cornerBracket(HX + HS + BRK_PAD, HY - BRK_PAD,      -1, +1)}
  ${cornerBracket(HX - BRK_PAD,      HY + HS + BRK_PAD, +1, -1)}
  ${cornerBracket(HX + HS + BRK_PAD, HY + HS + BRK_PAD, -1, -1)}
  ${showBadge ? rect(BADGE_X, BADGE_Y, BADGE_W, BADGE_H, rarity.color) : ''}
  ${showBadge ? textPath(rarity.tag, {
    x: BADGE_X + BADGE_W / 2,
    y: BADGE_Y + BADGE_H / 2 + 1,
    fontSize: BADGE_FONT,
    fill: WHITE,
    anchor: 'center middle',
    pixel: true,
  }) : ''}
  ${rect(BAN_X, BAN_Y, BAN_W, BAN_H, LIME)}
  ${textPath(traitName, {
    x: BAN_X + BAN_W / 2,
    y: BAN_Y + BAN_H / 2 + 4,
    fontSize: BAN_FONT,
    fill: BLACK,
    anchor: 'center middle',
    pixel: true,
  })}
  ${statFields
    .map((f) => {
      const x = ST_X + f.col * ST_COL_W;
      const y = ST_Y + f.row * ST_ROW_H;
      const arrowGap = 22;
      const arrow = textPath('>', { x, y, fontSize: ST_FONT, fill: LIME, anchor: 'left top' });
      const label = textPath(`${f.label}:`, { x: x + arrowGap, y, fontSize: ST_FONT, fill: LIME, anchor: 'left top' });
      const labelW = measureText(`${f.label}: `, ST_FONT) + arrowGap + 8;
      const value = textPath(f.value, { x: x + labelW, y, fontSize: ST_FONT, fill: WHITE, anchor: 'left top' });
      return arrow + label + value;
    })
    .join('\n  ')}
  ${textPath(footerText, {
    x: W / 2,
    y: FOOT_Y,
    fontSize: 18,
    fill: FOOT_GRAY,
    anchor: 'center top',
  })}
</svg>`;
}

/**
 * Render full v4 card to PNG buffer.
 * @param {Object} args — same as buildV4CardSvg
 * @returns {Buffer}
 */
export function renderV4CardPng(args) {
  const svg = buildV4CardSvg(args);
  return new Resvg(svg, { fitTo: { mode: 'width', value: V4_W } })
    .render()
    .asPng();
}

/**
 * Build a single PNG frame for animation (used by GIF generator).
 * Same as renderV4CardPng but accepts an explicit traitB64 for the variant.
 * @param {Object} args
 * @returns {Buffer}
 */
export function renderV4CardFramePng(args) {
  return renderV4CardPng(args);
}

/**
 * Convenience: load a single trait variant SVG (by id) as base64 data URL.
 * Used by the GIF loop to feed buildV4CardSvg with per-frame variants.
 */
export function loadTraitSvgAsB64(variantId) {
  const ROOT = process.cwd();
  return svgFileToPngBase64(
    path.join(ROOT, `public/labimages/${variantId}.svg`),
    V4_HS
  );
}

export const V4_VERSION = 'v4-light-a-1';

// Independent v4 card render endpoint.
// Light hero + rarity badge (style "a"). PNG only. Traits 1-9999.
// Path: /api/render/floppy-v4/[tokenId].png
// Built off scripts/preview-card-v4.mjs — kept self-contained so
// we can verify in production before swapping the real /floppy/[id] route.

import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import TextToSVG from 'text-to-svg';

let _ttsRetro = null;
let _ttsPixel = null;
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

function svgToPngBase64(absPath, size) {
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

async function getTotalMintedSafe(tokenIdNum, fallback) {
  try {
    const { getContracts } = await import('../../../../lib/contracts.js');
    const { traitsCore } = await Promise.race([
      getContracts(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getContracts timeout 8000ms')), 8000)),
    ]);
    const minted = await Promise.race([
      traitsCore.totalMintedPerAsset(tokenIdNum),
      new Promise((_, reject) => setTimeout(() => reject(new Error('totalMintedPerAsset timeout 5000ms')), 5000)),
    ]);
    return minted.toNumber();
  } catch (err) {
    console.warn(`[floppy-v4] totalMinted fallback for ${tokenIdNum}: ${err.message}`);
    return fallback;
  }
}

async function renderCard(tokenIdNum) {
  const ROOT = process.cwd();

  // metadata
  const traitsPath = path.join(ROOT, 'public/labmetadata/traits.json');
  const traits = JSON.parse(fs.readFileSync(traitsPath, 'utf8'));
  const tokenData = traits.traits.find((t) => t.tokenId === tokenIdNum);
  if (!tokenData) {
    const err = new Error(`Token ${tokenIdNum} not found`);
    err.statusCode = 404;
    throw err;
  }

  // rarity
  const rarityTiers = [
    { max: 1,   tag: 'LEGENDARY', color: '#ff6b00' },
    { max: 5,   tag: 'EPIC',      color: '#9b59b6' },
    { max: 10,  tag: 'RARE',      color: '#3498db' },
    { max: 50,  tag: 'UNCOMMON',  color: '#2ecc71' },
    { max: 100, tag: 'COMMON',    color: '#95a5a6' },
  ];
  const maxSupply = tokenData.maxSupply || 100;
  const rarity =
    rarityTiers.find((r) => maxSupply <= r.max) ||
    rarityTiers[rarityTiers.length - 1];

  // total minted (on-chain w/ fallback)
  const totalMinted = await getTotalMintedSafe(tokenIdNum, maxSupply);

  // palette
  const BLACK = '#000000';
  const WHITE = '#ffffff';
  const LIME = '#c9f227';
  const HERO_BG = '#f1efe4';
  const DOT_COLOR = '#7a9418';
  const FOOT_GRAY = '#9aa3ad';

  // logo recoloured to LIME
  const zeroLabSvg = loadSvgInline(
    path.join(ROOT, 'public/labimages/zerolab-dollar.svg')
  );
  const logoSvg = zeroLabSvg
    .replace(/#95c11f/gi, LIME)
    .replace(/fill:#95c11f/gi, `fill:${LIME}`);
  const logoPng = new Resvg(logoSvg, { fitTo: { mode: 'width', value: 720 } })
    .render()
    .asPng();
  const logoB64 = `data:image/png;base64,${logoPng.toString('base64')}`;

  // geometry
  const W = 1024;
  const H = 1400;
  const LOGO_W = 720;
  const LOGO_RATIO = 454.74 / 99.2;
  const LOGO_H = LOGO_W / LOGO_RATIO;
  const LOGO_X = (W - LOGO_W) / 2;
  const LOGO_Y = 56;
  const HS = 800;
  const HX = (W - HS) / 2;
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

  // hero images
  const mannequinB64 = svgToPngBase64(
    path.join(ROOT, 'public/labimages/mannequin.svg'),
    HS
  );
  const traitB64 = svgToPngBase64(
    path.join(ROOT, `public/labimages/${tokenIdNum}.svg`),
    HS
  );

  // helpers
  const rect = (x, y, w, h, fill, opacity) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opacity != null ? ` opacity="${opacity}"` : ''}/>`;

  const cornerBracket = (cx, cy, dx, dy) => {
    const horiz = `<rect x="${dx === 1 ? cx : cx - BRK_LEN}" y="${cy - BRK_W / 2}" width="${BRK_LEN}" height="${BRK_W}" fill="${LIME}"/>`;
    const vert = `<rect x="${cx - BRK_W / 2}" y="${dy === 1 ? cy : cy - BRK_LEN}" width="${BRK_W}" height="${BRK_LEN}" fill="${LIME}"/>`;
    return horiz + vert;
  };

  // composition
  const traitName = (tokenData.name || '').toUpperCase();
  const creatorName = 'TIGER+ADRIAN';
  const seriesLabel = (tokenData.floppy || 'OG').toUpperCase();
  const assetId = `#${String(tokenIdNum).padStart(5, '0')}`;
  const statFields = [
    { col: 0, row: 0, label: 'CATEGORY',     value: (tokenData.category || '').toUpperCase() },
    { col: 0, row: 1, label: 'TOTAL MINTED', value: String(totalMinted) },
    { col: 0, row: 2, label: 'SERIES',       value: seriesLabel },
    { col: 1, row: 0, label: 'CREATOR',      value: creatorName },
    { col: 1, row: 1, label: 'BLOCKCHAIN',   value: 'BASE' },
    { col: 1, row: 2, label: 'ASSET ID',     value: assetId },
  ];
  const footerText = `> ZEROLAB ASSET // BE REAL | BE $ZERO`;

  // banner font size (auto-fit)
  const BAN_INNER_PAD = 28;
  let BAN_FONT = 44;
  while (BAN_FONT > 16 && measureText(traitName, BAN_FONT, true) > BAN_W - BAN_INNER_PAD * 2) {
    BAN_FONT -= 2;
  }

  // rarity badge geometry (style "a")
  const BADGE_FONT = 22;
  const BADGE_TEXT_W = measureText(rarity.tag, BADGE_FONT, true);
  const BADGE_W = BADGE_TEXT_W + 28;
  const BADGE_H = 38;
  const BADGE_X = HX + HS - 14 - BADGE_W;
  const BADGE_Y = HY + 14;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
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

  ${rect(BADGE_X, BADGE_Y, BADGE_W, BADGE_H, rarity.color)}
  ${textPath(rarity.tag, {
    x: BADGE_X + BADGE_W / 2,
    y: BADGE_Y + BADGE_H / 2 + 1,
    fontSize: BADGE_FONT,
    fill: WHITE,
    anchor: 'center middle',
    pixel: true,
  })}

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

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } })
    .render()
    .asPng();
  return png;
}

export default async function handler(req, res) {
  // CORS — same allowlist as the existing endpoint
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com',
    'https://opensea.io',
    'https://testnets.opensea.io',
    'https://rarible.com',
    'https://looksrare.org',
    'https://x2y2.io',
    'https://blur.io',
    'https://magiceden.io',
    'https://element.market',
    'https://tensor.trade',
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let { tokenId } = req.query;
    if (typeof tokenId === 'string' && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    const tokenIdNum = parseInt(tokenId, 10);
    if (!Number.isFinite(tokenIdNum)) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    if (tokenIdNum < 1 || tokenIdNum > 9999) {
      return res.status(400).json({
        error: 'floppy-v4 currently supports traits 1-9999 only',
      });
    }

    console.log(`[floppy-v4] Rendering token ${tokenIdNum}`);
    const png = await renderCard(tokenIdNum);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Version', 'FLOPPY-V4-LIGHT-A');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(png);
  } catch (err) {
    console.error('[floppy-v4] Error:', err);
    const code = err.statusCode || 500;
    return res
      .status(code)
      .json({ error: err.message || 'Internal error' });
  }
}

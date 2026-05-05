// Preview v4 layout for special-range items (floppies, T-shits, OG covers).
// All render as STANDALONE (no mannequin) — the item itself fills the hero.
// Run: node scripts/preview-card-v4-special.mjs floppy 10003
//      node scripts/preview-card-v4-special.mjs tshit 30001
//      node scripts/preview-card-v4-special.mjs ogcover 100001

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { buildV4CardSvg, V4_W, V4_HS } from '../lib/renderers/card-v4-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const itemType = process.argv[2]; // 'floppy' | 'tshit' | 'ogcover'
const tokenId = parseInt(process.argv[3] || '', 10);
if (!itemType || !Number.isFinite(tokenId)) {
  console.error('Usage: node scripts/preview-card-v4-special.mjs <floppy|tshit|ogcover> <tokenId>');
  process.exit(1);
}

async function getFloppyB64(id) {
  // GIF or PNG. For animated GIFs, sharp without `animated: true` reads only
  // frame 0 — using `animated: true` returns a vertical strip of ALL frames,
  // which is what produced the stacked-floppies bug in the first preview.
  const gifPath = path.join(ROOT, `public/labimages/${id}.gif`);
  const pngPath = path.join(ROOT, `public/labimages/${id}.png`);

  const srcPath = fs.existsSync(gifPath) ? gifPath : (fs.existsSync(pngPath) ? pngPath : null);
  if (!srcPath) throw new Error(`No floppy asset for ${id}`);
  console.log(`[preview] floppy ${id}: ${srcPath.endsWith('.gif') ? 'GIF (frame 0)' : 'PNG'}`);

  // For animated GIFs sharp by default reads ALL frames stacked — pin to frame 0.
  const png = await sharp(fs.readFileSync(srcPath), { page: 0, pages: 1 })
    .resize(V4_HS, V4_HS, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function getTshitB64(id) {
  // V1 legacy real mints (30000-30013): GitHub raw.
  // V2 (30014+): on-chain designURI via TShitMintFacet.
  const { isTShitV2, resolveTShitUri } = await import('../lib/v2/rpc/tshit-resolver.js');
  let url;
  if (isTShitV2(id)) {
    url = await resolveTShitUri(id);
    if (!url) throw new Error(`No on-chain designURI for T-Shit V2 ${id}`);
  } else {
    url = `https://raw.githubusercontent.com/adriangallery/adrianzero/main/designs/${id}.svg`;
  }
  console.log(`[preview] tshit ${id}: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const png = new Resvg(buf, { fitTo: { mode: 'width', value: V4_HS } }).render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function getOgCoverB64(id) {
  const svgPath = path.join(ROOT, `public/labimages/ogpunks/${id}.svg`);
  if (!fs.existsSync(svgPath)) throw new Error(`OG cover SVG missing: ${svgPath}`);
  console.log(`[preview] ogcover ${id}: ${svgPath}`);
  const buf = fs.readFileSync(svgPath);
  const png = new Resvg(buf, { fitTo: { mode: 'width', value: V4_HS } }).render().asPng();
  return `data:image/png;base64,${png.toString('base64')}`;
}

function getTokenData(type, id) {
  if (type === 'floppy') {
    const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/labmetadata/floppy.json'), 'utf8'));
    return f.floppys.find((x) => x.tokenId === id);
  }
  if (type === 'tshit') {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/labmetadata/studio.json'), 'utf8'));
    const entry = s[String(id)];
    if (entry) return { tokenId: id, ...entry, floppy: 'STUDIO' };
    // V2 fallback
    return {
      tokenId: id,
      name: `Studio T-Shit #${id - 30000 + 1}`,
      category: 'SWAG',
      maxSupply: 1,
      floppy: 'STUDIO',
    };
  }
  if (type === 'ogcover') {
    const o = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/labmetadata/ogpunks.json'), 'utf8'));
    return o.traits.find((x) => x.tokenId === id);
  }
  return null;
}

async function main() {
  const tokenData = getTokenData(itemType, tokenId);
  if (!tokenData) {
    console.error(`No metadata for ${itemType} ${tokenId}`);
    process.exit(1);
  }
  console.log(`[preview] ${itemType} ${tokenId}: ${tokenData.name} | ${tokenData.category}`);

  let traitB64;
  let skipMannequin;
  if (itemType === 'floppy')   { traitB64 = await getFloppyB64(tokenId);  skipMannequin = true; }
  else if (itemType === 'tshit')   { traitB64 = await getTshitB64(tokenId);   skipMannequin = false; } // mannequin + design overlay (legacy behaviour)
  else if (itemType === 'ogcover') { traitB64 = await getOgCoverB64(tokenId); skipMannequin = true; } // OG cover SVG already complete
  else { console.error(`Unknown type: ${itemType}`); process.exit(1); }

  const totalMinted = tokenData.maxSupply || 1; // approx; preview only

  const svg = buildV4CardSvg({
    tokenIdNum: tokenId,
    tokenData,
    totalMinted,
    traitB64Override: traitB64,
    skipMannequin,
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: V4_W } }).render().asPng();
  const out = path.join(ROOT, `preview-v4-${itemType}-${tokenId}.png`);
  fs.writeFileSync(out, png);
  console.log(`✓ ${out}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

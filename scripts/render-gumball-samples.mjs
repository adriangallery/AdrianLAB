/**
 * render-gumball-samples.mjs — v8
 * Renders GumballZERO v8 samples. Compositor directo, sin servidor.
 * Limpia g7-* (y anteriores) antes de generar g8-*. Timeout 60s/imagen.
 *
 * Full-size (6 tokens):
 *   9002  Common clean (2t)  [854,844]                     — BG sólido + SWAG, sin acento
 *   9009  Common clean (2t)  [51,117]                      — BG azul + SWAG, sin acento
 *   9005  Common hair  (3t)  [51,458,437]                  — BG + SWAG + HAIR (1 acento)
 *   9048  Bubble-gum   (4t)  [1172,464,786,557]            — 557 Bubble-Gum, Uncommon
 *   9034  Rare+GEAR    (6t)  [794,43,1067,824,72,1005]     — Rare con GEAR
 *   9043  Legendary    (7t)  [1175,758,433,570,682,1171,270] — GOO(270)+GEAR
 *
 * Contact sheet (28 tokens, 7×4 grid):
 *   2 Legendary, 5 Rare, 7 Uncommon, 14 Common
 *   → tmp-gumball-samples/g8-contactsheet.png
 */

import { writeFileSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tmp-gumball-samples');

mkdirSync(OUT_DIR, { recursive: true });

for (const f of readdirSync(OUT_DIR)) {
  if (/^g[3-7]-/.test(f)) { unlinkSync(join(OUT_DIR, f)); console.log(`Removed: ${f}`); }
}

process.chdir(ROOT);

const { compositeToken } = await import('../lib/v2/render/compositor.js');
const gumsData = JSON.parse(readFileSync(join(ROOT, 'public', 'labmetadata', 'gums.json'), 'utf8'));

function buildFakeTokenData(tokenId) {
  const gum = gumsData.gums.find(g => g.tokenId === tokenId);
  if (!gum) throw new Error(`tokenId ${tokenId} not found`);
  return {
    tokenId, generation: 0, originalGeneration: 0, mutationLevel: 0,
    canReplicate: false, replicationCount: 0, lastReplication: 0, hasBeenModified: false,
    skinId: 5, skinName: 'Light', effectiveSkinId: 5, effectiveSkinName: 'Light',
    tagInfo: { tag: 'GumballZERO', deployer: null, isMinted: true },
    categories: [], traitIds: [],
    dupInfo: { duplicated: false, dupNumber: 0 },
    serumHistory: [], appliedSerum: null, serumFailed: false,
    failedSerumType: null, hasAdrianGFSerum: false,
    tokenStatus: { hasProfile: false },
    profileName: null, movieId: null, movieRental: null, _samuraiIndex: null, honor: 0,
  };
}

function withTimeout(p, ms) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`Timeout ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}

async function renderToken(tokenId) {
  const gum = gumsData.gums.find(g => g.tokenId === tokenId);
  const traitIds = gum ? JSON.parse(gum.traits) : [];
  try {
    const { buffer } = await withTimeout(
      compositeToken(buildFakeTokenData(tokenId), {
        closeup: false, shadow: false, glow: false, bn: false,
        uv: false, blackout: false, messageText: null,
        animatedTraitIds: new Set(), splitBackground: false,
      }),
      60_000
    );
    return { ok: true, buffer, traitIds };
  } catch (err) {
    return { ok: false, error: err.message, traitIds };
  }
}

// ============================================================
// FULL-SIZE (6)
// ============================================================
const FULL_SAMPLES = [
  { tokenId: 9002, label: 'common-clean-2t' },
  { tokenId: 9009, label: 'common-clean-blue' },
  { tokenId: 9005, label: 'common-hair' },
  { tokenId: 9048, label: 'bubblegum-557' },
  { tokenId: 9034, label: 'rare-gear' },
  { tokenId: 9043, label: 'legendary-goo-gear' },
];

console.log('\n=== FULL-SIZE SAMPLES (g8-*) ===');
const fullResults = [];
for (const { tokenId, label } of FULL_SAMPLES) {
  const gum = gumsData.gums.find(g => g.tokenId === tokenId);
  const traitIds = gum ? JSON.parse(gum.traits) : [];
  console.log(`\nRendering g8-${label}-${tokenId}...  traits=[${traitIds.join(',')}]`);
  const result = await renderToken(tokenId);
  if (result.ok) {
    const outPath = join(OUT_DIR, `g8-${label}-${tokenId}.png`);
    writeFileSync(outPath, result.buffer);
    console.log(`  OK → ${outPath} (${Math.round(result.buffer.length / 1024)}KB)`);
    fullResults.push({ label, tokenId, path: outPath, traits: traitIds, ok: true, kb: Math.round(result.buffer.length / 1024) });
  } else {
    console.error(`  ERROR ${tokenId}: ${result.error}`);
    fullResults.push({ label, tokenId, path: null, ok: false, error: result.error, traits: traitIds });
  }
}

console.log('\n=== BG pixel check (corner 5,5) ===');
for (const r of fullResults) {
  if (!r.ok) continue;
  const img = await loadImage(r.path);
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);
  const px = c.getContext('2d').getImageData(5, 5, 1, 1).data;
  console.log(`  ${r.path.split('/').pop().padEnd(52)} rgb(${px[0]},${px[1]},${px[2]}) alpha=${px[3]} ${px[3]===255?'OPAQUE-OK':'TRANSPARENT-FAIL'}`);
}

// ============================================================
// CONTACT SHEET — 28 tokens, 7×4 grid
// ============================================================
const CONTACT_IDS = [
  // Legendary (2)
  9043, 9039,
  // Rare (5) — GEAR, bubble-gum, GOO variants
  9034, 9082, 9060, 9010, 9021,
  // Uncommon (7) — variety of acentos
  9001, 9005, 9011, 9022, 9048, 9074, 9076,
  // Common (14) — 2-trait clean + some with acento
  9002, 9004, 9007, 9008, 9009, 9013, 9014,
  9016, 9017, 9028, 9029, 9030, 9032, 9036,
];

const COLS = 7, ROWS = 4, CELL_SIZE = 200, LABEL_H = 20;
const CELL_H = CELL_SIZE + LABEL_H;

console.log(`\n=== CONTACT SHEET (${COLS}×${ROWS}, ${CELL_SIZE}px/cell, ${CONTACT_IDS.length} tokens) ===`);

const contactBufs = new Map();
for (const r of fullResults) if (r.ok) contactBufs.set(r.tokenId, { path: r.path, ok: true });

for (const tokenId of CONTACT_IDS) {
  if (contactBufs.has(tokenId)) { console.log(`  ${tokenId} (cached)`); continue; }
  const gum = gumsData.gums.find(g => g.tokenId === tokenId);
  const traitIds = gum ? JSON.parse(gum.traits) : [];
  process.stdout.write(`  ${tokenId}... [${traitIds.join(',')}]`);
  const result = await renderToken(tokenId);
  if (result.ok) {
    const tmp = join(OUT_DIR, `_tmp_c8_${tokenId}.png`);
    writeFileSync(tmp, result.buffer);
    process.stdout.write(` OK (${Math.round(result.buffer.length/1024)}KB)\n`);
    contactBufs.set(tokenId, { path: tmp, ok: true });
  } else {
    process.stdout.write(` ERROR: ${result.error}\n`);
    contactBufs.set(tokenId, { ok: false });
  }
}

console.log('\nAssembling...');
const cells = [];
for (let i = 0; i < CONTACT_IDS.length; i++) {
  const tokenId = CONTACT_IDS[i];
  const e = contactBufs.get(tokenId);
  if (!e || !e.ok) continue;
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = col * CELL_SIZE, y = row * CELL_H;
  const resized = await sharp(e.path).resize(CELL_SIZE, CELL_SIZE, { fit: 'fill' }).toBuffer();
  cells.push({ input: resized, top: y, left: x });
  const lbl = `<svg width="${CELL_SIZE}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg"><rect width="${CELL_SIZE}" height="${LABEL_H}" fill="white"/><text x="${CELL_SIZE/2}" y="${LABEL_H-5}" font-family="monospace" font-size="11" fill="black" text-anchor="middle">#${tokenId}</text></svg>`;
  cells.push({ input: Buffer.from(lbl), top: y + CELL_SIZE, left: x });
}

const blank = await sharp({ create: { width: COLS*CELL_SIZE, height: ROWS*CELL_H, channels: 3, background: { r:220,g:220,b:220 } } }).png().toBuffer();
const sheetPath = join(OUT_DIR, 'g8-contactsheet.png');
await sharp(blank).composite(cells).png({ compressionLevel: 6 }).toFile(sheetPath);
console.log(`Contact sheet → ${sheetPath} (${Math.round(readFileSync(sheetPath).length/1024)}KB)`);

for (const tokenId of CONTACT_IDS) {
  const e = contactBufs.get(tokenId);
  if (e && e.path && e.path.includes('_tmp_c8_')) try { unlinkSync(e.path); } catch(_) {}
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n=== RESULTADO v8 ===');
let fails = 0;
for (const r of fullResults) {
  if (r.ok) console.log(`  [OK ] g8-${r.label}-${r.tokenId}.png  traits=[${r.traits.join(',')}]  ${r.kb}KB`);
  else { fails++; console.log(`  [ERR] g8-${r.label}-${r.tokenId}  ${r.error}`); }
}
console.log(`\nFull-size: ${fullResults.length-fails}/${fullResults.length} OK`);
console.log(`Contact sheet: ${sheetPath}`);
if (fails > 0) process.exit(1);

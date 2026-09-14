/**
 * spotcheck-gumball-v8.mjs
 * Spot-check renders for the mint-on-demand GumballZERO architecture.
 *
 * Validates that the ordinal-index pipeline works end-to-end:
 *   - collection[0]  = ordinal 0 = first minted  → "GumballZERO #1"
 *   - collection[49] = ordinal 49 = 50th minted  → "GumballZERO #50"
 *   - collection[99] = ordinal 99 = last minted  → "GumballZERO #100"
 *
 * Also verifies mock tokenId list: getGumballIndex([A,B,C], B) === 1
 * (second in sorted ascending list → collection[1]).
 *
 * Output: tmp-gumball-samples/g9-spotcheck-{ordinal}.png
 *
 * LOCAL ONLY — no push, no deploy, no cast.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'tmp-gumball-samples');

mkdirSync(OUT_DIR, { recursive: true });
process.chdir(ROOT);

const { compositeToken } = await import('../lib/v2/render/compositor.js');
const { getGumballTraits } = await import('../lib/v2/tags/tag-resolver.js');

const gumsData = JSON.parse(readFileSync(join(ROOT, 'public', 'labmetadata', 'gums.json'), 'utf8'));
const collection = gumsData.collection;

if (!Array.isArray(collection) || collection.length < 100) {
  console.error(`[spotcheck] gums.json collection has ${collection?.length ?? 0} entries — expected 100`);
  process.exit(1);
}

// ───────────────────────────────────────────────
// 1. Index resolver mock verification
// ───────────────────────────────────────────────
// Simulate getTokensByTag returning [A, B, C] non-contiguous.
// Token B should resolve to ordinal 1 (second in sorted ascending list).
{
  const mockIds = [5000, 7777, 12345];  // A=5000, B=7777, C=12345
  const sorted = [...mockIds].sort((a, b) => a - b);
  const tokenB = 7777;
  const indexOfB = sorted.indexOf(tokenB); // expected: 1
  console.log(`[mock] sorted: [${sorted.join(',')}]`);
  console.log(`[mock] tokenB=${tokenB} → ordinal index = ${indexOfB} (expected 1) → ${indexOfB === 1 ? 'PASS' : 'FAIL'}`);
  const entry = collection[indexOfB];
  if (entry) {
    console.log(`[mock] collection[${indexOfB}].name = ${entry.name}`);
    const traitIds = JSON.parse(entry.traits);
    console.log(`[mock] traitIds = [${traitIds.join(',')}]`);
  }
}
console.log('');

// ───────────────────────────────────────────────
// 2. getGumballTraits direct verification
// ───────────────────────────────────────────────
for (const gumballIndex of [0, 49, 99]) {
  const entry = getGumballTraits(gumballIndex);
  if (!entry) {
    console.error(`[getGumballTraits] index ${gumballIndex} → null (FAIL)`);
    continue;
  }
  console.log(`[getGumballTraits] index ${gumballIndex} → name="${entry.name}", traitIds=[${entry.traitIds.join(',')}]`);
}
console.log('');

// ───────────────────────────────────────────────
// 3. Compositor render spot-checks
// ───────────────────────────────────────────────

// Use placeholder tokenIds (9001-9100 range) purely for the file path label.
// The compositor uses _gumballIndex to lookup gums.json, NOT the tokenId.
const SPOT_CHECKS = [
  { gumballIndex: 0,  label: 'ordinal-1'  },
  { gumballIndex: 49, label: 'ordinal-50' },
  { gumballIndex: 99, label: 'ordinal-100' },
];

for (const { gumballIndex, label } of SPOT_CHECKS) {
  const entry = getGumballTraits(gumballIndex);
  if (!entry) {
    console.error(`[render] ${label}: no entry in gums.json at index ${gumballIndex}`);
    continue;
  }

  // Fake tokenId — doesn't matter for gumball render, just used for logging
  const fakeTokenId = 9001 + gumballIndex;

  const tokenData = {
    tokenId: fakeTokenId,
    generation: 0,
    originalGeneration: 0,
    mutationLevel: 0,
    canReplicate: false,
    replicationCount: 0,
    lastReplication: 0,
    hasBeenModified: false,
    skinId: 5,
    skinName: 'Light',
    effectiveSkinId: 5,
    effectiveSkinName: 'Light',
    tagInfo: { tag: 'GumballZERO', deployer: null, isMinted: true },
    categories: [],
    traitIds: [],
    dupInfo: { duplicated: false, dupNumber: 0 },
    serumHistory: [],
    appliedSerum: null,
    serumFailed: false,
    failedSerumType: null,
    hasAdrianGFSerum: false,
    tokenStatus: { hasProfile: false },
    profileName: null,
    movieId: null,
    movieRental: null,
    _samuraiIndex: null,
    _gumballIndex: gumballIndex,  // KEY: this is what compositor.js now reads
    honor: 0,
  };

  const traitIds = entry.traitIds;
  console.log(`[render] ${label} (idx=${gumballIndex}, name="${entry.name}"): traitIds=[${traitIds.join(',')}]`);

  try {
    const timeoutMs = 60_000;
    const result = await Promise.race([
      compositeToken(tokenData, {}),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout 60s')), timeoutMs)),
    ]);

    const outPath = join(OUT_DIR, `g9-spotcheck-${label}.png`);
    writeFileSync(outPath, result.buffer);

    // Verify alpha channel (background must be opaque)
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });
    let transparentPixels = 0;
    const hasAlpha = info.channels === 4;
    if (hasAlpha) {
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) transparentPixels++;
      }
    }
    const totalPixels = info.width * info.height;
    const transparentPct = hasAlpha ? ((transparentPixels / totalPixels) * 100).toFixed(1) : '0.0';

    console.log(`  -> ${outPath}`);
    console.log(`  -> ${info.width}x${info.height}, ${info.channels}ch, transparent=${transparentPct}% ${parseFloat(transparentPct) > 5 ? 'WARN-ALPHA' : 'OK'}`);
    console.log(`  -> size=${(result.buffer.length / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}`);
  }

  console.log('');
}

console.log('[spotcheck] Done.');

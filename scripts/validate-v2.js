#!/usr/bin/env node
// ============================================
// V2 Validation Script — Compare V1 vs V2 output
// ============================================
// Usage: node scripts/validate-v2.js [baseUrl]
// Default baseUrl: http://localhost:3000
//
// Compares /api/render/ vs /api/v2/render/ for pixel differences
// Compares /api/metadata/ vs /api/v2/metadata/ for JSON differences
//
// Requires the Next.js dev server to be running.

const BASE = process.argv[2] || 'http://localhost:3000';

// ===== TOKEN TEST CASES =====
const TEST_TOKENS = {
  // Regular tokens (various generations)
  regular: [1, 2, 5, 10, 50, 100, 200, 300, 400, 500],
  // Tokens with known serums
  serums: [/* Add tokens with serums here once identified */],
  // SubZERO tokens
  subzero: [/* Add SubZERO token IDs here */],
  // SamuraiZERO tokens
  samurai: [/* Add SamuraiZERO token IDs here */],
  // Duplicated (GenZERO)
  duplicated: [/* Add GenZERO token IDs here */],
  // OG Punks
  ogpunks: [/* Add 100001-101003 range here */],
  // Special tokens
  special: [302, 441, 442, 445, 454, 459],
  // Tokens with toggles (check at runtime)
  toggles: [/* Add tokens with active toggles here */],
  // Studio range
  studio: [/* Add 30000-35000 range here */],
};

// Flatten all tokens
function getAllTokens() {
  const all = new Set();
  for (const group of Object.values(TEST_TOKENS)) {
    for (const id of group) all.add(id);
  }
  // Always include at least these common tokens
  [1, 2, 3, 5, 10, 42, 100, 200, 302, 441, 442, 445, 454, 459].forEach(id => all.add(id));
  return [...all].sort((a, b) => a - b);
}

// ===== METADATA COMPARISON =====
async function compareMetadata(tokenId) {
  const [v1, v2] = await Promise.all([
    fetchJson(`${BASE}/api/metadata/${tokenId}`),
    fetchJson(`${BASE}/api/v2/metadata/${tokenId}`),
  ]);

  if (!v1.ok || !v2.ok) {
    return {
      tokenId,
      status: 'ERROR',
      v1Status: v1.status,
      v2Status: v2.status,
      diff: null,
    };
  }

  // Compare relevant fields (ignore debug, timestamps, exact image URLs)
  const diffs = [];

  if (v1.data.name !== v2.data.name) {
    diffs.push(`name: "${v1.data.name}" vs "${v2.data.name}"`);
  }

  // Compare attributes by trait_type
  const v1Attrs = new Map((v1.data.attributes || []).map(a => [a.trait_type, a.value]));
  const v2Attrs = new Map((v2.data.attributes || []).map(a => [a.trait_type, a.value]));

  const allKeys = new Set([...v1Attrs.keys(), ...v2Attrs.keys()]);
  for (const key of allKeys) {
    const val1 = v1Attrs.get(key);
    const val2 = v2Attrs.get(key);
    if (String(val1) !== String(val2)) {
      diffs.push(`attr[${key}]: "${val1}" vs "${val2}"`);
    }
  }

  return {
    tokenId,
    status: diffs.length === 0 ? 'MATCH' : 'DIFF',
    diffs,
    v1Headers: { cache: v1.headers?.['x-cache'], time: v1.headers?.['x-response-time'] },
    v2Headers: { cache: v2.headers?.['x-cache'], time: v2.headers?.['x-response-time'] },
  };
}

// ===== RENDER COMPARISON =====
async function compareRender(tokenId) {
  const [v1, v2] = await Promise.all([
    fetchBuffer(`${BASE}/api/render/${tokenId}.png`),
    fetchBuffer(`${BASE}/api/v2/render/${tokenId}.png`),
  ]);

  if (!v1.ok || !v2.ok) {
    return {
      tokenId,
      status: 'ERROR',
      v1Status: v1.status,
      v2Status: v2.status,
    };
  }

  // Compare file sizes
  const sizeDiff = Math.abs(v1.buffer.length - v2.buffer.length);
  const sizeRatio = v1.buffer.length > 0 ? v2.buffer.length / v1.buffer.length : 0;

  // Simple byte comparison
  const identical = v1.buffer.equals(v2.buffer);

  // If not identical, compute pixel difference (requires sharp)
  let pixelDiffPercent = null;
  if (!identical) {
    try {
      const sharp = (await import('sharp')).default;

      const raw1 = await sharp(v1.buffer).raw().toBuffer({ resolveWithObject: true });
      const raw2 = await sharp(v2.buffer).ensureAlpha().resize(raw1.info.width, raw1.info.height).raw().toBuffer();

      let diffPixels = 0;
      const totalPixels = raw1.info.width * raw1.info.height;
      const channels = raw1.info.channels;

      for (let i = 0; i < raw1.data.length; i += channels) {
        let channelDiff = 0;
        for (let c = 0; c < Math.min(channels, 3); c++) {
          channelDiff += Math.abs((raw1.data[i + c] || 0) - (raw2[i + c] || 0));
        }
        if (channelDiff > 10) diffPixels++; // threshold: 10 total across RGB
      }

      pixelDiffPercent = ((diffPixels / totalPixels) * 100).toFixed(2);
    } catch (err) {
      pixelDiffPercent = 'ERROR: ' + err.message;
    }
  }

  return {
    tokenId,
    status: identical ? 'IDENTICAL' : pixelDiffPercent === '0.00' ? 'NEAR-MATCH' : 'DIFF',
    v1Size: v1.buffer.length,
    v2Size: v2.buffer.length,
    sizeRatio: sizeRatio.toFixed(3),
    pixelDiffPercent,
    v1Time: v1.headers?.['x-render-time'] || v1.elapsed + 'ms',
    v2Time: v2.headers?.['x-render-time'] || v2.elapsed + 'ms',
    v2Cache: v2.headers?.['x-cache'],
  };
}

// ===== FETCH HELPERS =====
async function fetchJson(url) {
  try {
    const start = Date.now();
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const elapsed = Date.now() - start;
    if (!resp.ok) return { ok: false, status: resp.status };
    const headers = Object.fromEntries(resp.headers.entries());
    const data = await resp.json();
    return { ok: true, status: resp.status, data, headers, elapsed };
  } catch (err) {
    return { ok: false, status: 'TIMEOUT', error: err.message };
  }
}

async function fetchBuffer(url) {
  try {
    const start = Date.now();
    const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const elapsed = Date.now() - start;
    if (!resp.ok) return { ok: false, status: resp.status };
    const headers = Object.fromEntries(resp.headers.entries());
    const buffer = Buffer.from(await resp.arrayBuffer());
    return { ok: true, status: resp.status, buffer, headers, elapsed };
  } catch (err) {
    return { ok: false, status: 'TIMEOUT', error: err.message };
  }
}

// ===== MAIN =====
async function main() {
  const tokens = getAllTokens();
  console.log(`\n=== V2 Validation — ${tokens.length} tokens ===`);
  console.log(`Base URL: ${BASE}\n`);

  // --- Metadata comparison ---
  console.log('--- METADATA COMPARISON ---\n');
  let metaMatches = 0, metaDiffs = 0, metaErrors = 0;

  for (const tokenId of tokens) {
    const result = await compareMetadata(tokenId);
    const icon = result.status === 'MATCH' ? '✅' : result.status === 'ERROR' ? '❌' : '⚠️';
    console.log(`  ${icon} Token ${tokenId}: ${result.status}`);
    if (result.diffs && result.diffs.length > 0) {
      result.diffs.forEach(d => console.log(`      ${d}`));
    }
    if (result.v2Headers?.time) {
      console.log(`      V2 time: ${result.v2Headers.time} (cache: ${result.v2Headers.cache || 'none'})`);
    }

    if (result.status === 'MATCH') metaMatches++;
    else if (result.status === 'ERROR') metaErrors++;
    else metaDiffs++;
  }

  console.log(`\nMetadata: ${metaMatches} match, ${metaDiffs} diff, ${metaErrors} error\n`);

  // --- Render comparison ---
  console.log('--- RENDER COMPARISON ---\n');
  let renderMatch = 0, renderDiff = 0, renderErrors = 0;

  for (const tokenId of tokens) {
    const result = await compareRender(tokenId);
    const icon = result.status === 'IDENTICAL' ? '✅'
      : result.status === 'NEAR-MATCH' ? '🟡'
      : result.status === 'ERROR' ? '❌' : '⚠️';

    const timeInfo = result.v2Time ? ` (V1: ${result.v1Time}, V2: ${result.v2Time})` : '';
    const pixInfo = result.pixelDiffPercent !== null ? ` pixel-diff: ${result.pixelDiffPercent}%` : '';
    console.log(`  ${icon} Token ${tokenId}: ${result.status}${pixInfo}${timeInfo}`);

    if (result.status === 'IDENTICAL' || result.status === 'NEAR-MATCH') renderMatch++;
    else if (result.status === 'ERROR') renderErrors++;
    else renderDiff++;
  }

  console.log(`\nRender: ${renderMatch} match, ${renderDiff} diff, ${renderErrors} error\n`);

  // --- Summary ---
  console.log('=== SUMMARY ===');
  console.log(`Metadata: ${metaMatches}/${tokens.length} match (${((metaMatches / tokens.length) * 100).toFixed(1)}%)`);
  console.log(`Render:   ${renderMatch}/${tokens.length} match (${((renderMatch / tokens.length) * 100).toFixed(1)}%)`);

  if (metaDiffs > 0 || renderDiff > 0) {
    console.log('\n⚠️  Some differences found — review above output before enabling V2 swap.');
  } else if (metaErrors > 0 || renderErrors > 0) {
    console.log('\n❌ Some errors — check server logs.');
  } else {
    console.log('\n✅ All tokens match — V2 is ready for swap!');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

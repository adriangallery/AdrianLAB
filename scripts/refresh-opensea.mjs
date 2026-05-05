#!/usr/bin/env node
// Refresh OpenSea metadata + Vercel render cache for AdrianLAB traits.
//
// Flow per token:
//   1. (Optional) GET https://adrianlab.vercel.app/api/render/floppy/{id}.png?refresh=1
//      → forces v4 regeneration in the warm lambda + uploads new asset to GitHub raw
//   2. POST https://api.opensea.io/api/v2/chain/base/contract/{addr}/nfts/{id}/refresh
//      → tells OpenSea to re-fetch metadata + image
//
// Resume-safe: persists progress to .refresh-progress.json. Re-running picks up
// where it left off unless --reset is passed.
//
// Usage:
//   node scripts/refresh-opensea.mjs --ids 18,247,1178
//   node scripts/refresh-opensea.mjs --range 1-100
//   node scripts/refresh-opensea.mjs --all                  # every id in traits.json
//   node scripts/refresh-opensea.mjs --range 1-100 --dry-run
//   node scripts/refresh-opensea.mjs --range 1-100 --no-prewarm
//   OPENSEA_API_KEY=... node scripts/refresh-opensea.mjs --all
//   node scripts/refresh-opensea.mjs --range 1-100 --reset  # drop progress file

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---------- env loader (.env.local then .env) ----------
// No dotenv dep — keep it dependency-free. Existing process.env wins.
function loadEnvFile(absPath) {
  if (!fs.existsSync(absPath)) return;
  const raw = fs.readFileSync(absPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

// ---------- config ----------
const CONTRACT_ADDRESS = '0x90546848474FB3c9fda3fdAd887969bB244E7e58'; // AdrianTraitsCore on Base
const CHAIN = 'base';
const VERCEL_BASE = 'https://adrianlab.vercel.app';
const PROGRESS_FILE = path.join(ROOT, '.refresh-progress.json');

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY || '';
// Conservative defaults: with prewarm, latency naturally throttles us;
// without prewarm we'd hit 4 RPS so stay under it (300ms = 3.3 RPS).
const DELAY_MS = parseInt(process.env.REFRESH_DELAY_MS || '', 10) || (OPENSEA_API_KEY ? 250 : 350);
const VERCEL_TIMEOUT_MS = 60_000;            // GIFs can take 12s; allow margin
const OPENSEA_TIMEOUT_MS = 15_000;

// ---------- args ----------
function parseArgs(argv) {
  const args = {
    ids: null, range: null, all: false,
    floppies: false, serums: false, ogcovers: false, tshits: false, allTypes: false,
    dryRun: false, prewarm: true, reset: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ids') { args.ids = (argv[++i] || '').split(',').map((x) => parseInt(x.trim(), 10)).filter(Number.isFinite); }
    else if (a === '--range') {
      const m = (argv[++i] || '').match(/^(\d+)-(\d+)$/);
      if (m) args.range = [parseInt(m[1], 10), parseInt(m[2], 10)];
    }
    else if (a === '--all') args.all = true;
    else if (a === '--floppies') args.floppies = true;
    else if (a === '--serums') args.serums = true;
    else if (a === '--ogcovers') args.ogcovers = true;
    else if (a === '--tshits') args.tshits = true;
    else if (a === '--all-types') args.allTypes = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-prewarm') args.prewarm = false;
    else if (a === '--reset') args.reset = true;
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  return args;
}

function printHelp() {
  console.log(`refresh-opensea.mjs — refresh AdrianLAB items on OpenSea + Vercel

Selection (combinable):
  --ids 1,2,3        explicit list of token ids
  --range A-B        inclusive range
  --all              every tokenId present in traits.json (1-9999)
  --floppies         floppies / packs (10000-10100, from floppy.json)
  --serums           serums (262144-262147, from serums.json)
  --ogcovers         OG covers (100001-101003, from ogpunks.json)
  --tshits           T-Shits Studio (30000-35000, from studio.json)
  --all-types        --all + --floppies + --serums + --ogcovers + --tshits

Behavior:
  --dry-run          print actions, no HTTP
  --no-prewarm       skip the Vercel ?refresh=1 step (only call OpenSea)
  --reset            wipe .refresh-progress.json before starting
  --help

Env:
  OPENSEA_API_KEY    if set, throttle relaxed
  REFRESH_DELAY_MS   override delay between calls (default 250 with key, 350 without)
`);
}

function readJsonSafe(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch (e) { console.warn(`[refresh] could not read ${rel}: ${e.message}`); return null; }
}

function buildIdList(args) {
  const out = new Set();
  if (args.ids) args.ids.forEach((x) => out.add(x));
  if (args.range) {
    for (let i = args.range[0]; i <= args.range[1]; i++) out.add(i);
  }
  const wantAllTraits = args.all || args.allTypes;
  const wantFloppies  = args.floppies || args.allTypes;
  const wantSerums    = args.serums   || args.allTypes;
  const wantOgcovers  = args.ogcovers || args.allTypes;
  const wantTshits    = args.tshits   || args.allTypes;

  if (wantAllTraits) {
    const t = readJsonSafe('public/labmetadata/traits.json');
    (t?.traits || []).forEach((x) => {
      if (Number.isFinite(x.tokenId) && x.tokenId >= 1 && x.tokenId <= 9999) out.add(x.tokenId);
    });
  }
  if (wantFloppies) {
    const f = readJsonSafe('public/labmetadata/floppy.json');
    (f?.floppys || []).forEach((x) => { if (Number.isFinite(x.tokenId)) out.add(x.tokenId); });
  }
  if (wantSerums) {
    const s = readJsonSafe('public/labmetadata/serums.json');
    (s?.serums || []).forEach((x) => { if (Number.isFinite(x.tokenId)) out.add(x.tokenId); });
  }
  if (wantOgcovers) {
    const o = readJsonSafe('public/labmetadata/ogpunks.json');
    (o?.traits || []).forEach((x) => { if (Number.isFinite(x.tokenId)) out.add(x.tokenId); });
  }
  if (wantTshits) {
    const studio = readJsonSafe('public/labmetadata/studio.json');
    if (studio) {
      Object.keys(studio).forEach((k) => {
        const id = parseInt(k, 10);
        if (Number.isFinite(id)) out.add(id);
      });
    }
  }

  if (out.size === 0) {
    console.error('Need one of: --ids, --range, --all, --floppies, --serums, --ogcovers, --tshits, --all-types');
    process.exit(1);
  }
  return [...out].sort((a, b) => a - b);
}

// ---------- progress ----------
function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { done: [], failed: [], startedAt: null };
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch { return { done: [], failed: [], startedAt: null }; }
}
function saveProgress(p) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function prewarmVercel(tokenId) {
  const url = `${VERCEL_BASE}/api/render/floppy/${tokenId}.png?refresh=1&t=${Date.now()}`;
  const res = await withTimeout(fetch(url, { method: 'GET' }), VERCEL_TIMEOUT_MS, 'vercel');
  if (!res.ok) throw new Error(`vercel HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  const xv = res.headers.get('x-version') || '';
  const len = res.headers.get('content-length') || '?';
  return { ct, xv, len };
}

async function refreshOpenSea(tokenId, attempt = 1) {
  const url = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}/refresh`;
  const headers = { 'Accept': 'application/json' };
  if (OPENSEA_API_KEY) headers['X-API-KEY'] = OPENSEA_API_KEY;
  const res = await withTimeout(fetch(url, { method: 'POST', headers }), OPENSEA_TIMEOUT_MS, 'opensea');
  const body = await res.text().catch(() => '');

  // Rate limit / transient errors: backoff + retry up to 4 attempts
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
    const backoffMs = retryAfterSec
      ? retryAfterSec * 1000
      : Math.min(30_000, 1000 * Math.pow(2, attempt)); // 2s, 4s, 8s
    console.warn(`  ↻ opensea ${res.status} — sleeping ${backoffMs}ms (attempt ${attempt}/4)`);
    await sleep(backoffMs);
    return refreshOpenSea(tokenId, attempt + 1);
  }

  if (!res.ok) throw new Error(`opensea HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}`);
  return body;
}

// ---------- main ----------
async function main() {
  const args = parseArgs(process.argv);
  const ids = buildIdList(args);
  console.log(`[refresh] ${ids.length} ids, prewarm=${args.prewarm}, dryRun=${args.dryRun}, apiKey=${OPENSEA_API_KEY ? 'yes' : 'no'}, delay=${DELAY_MS}ms`);

  if (args.reset && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  const progress = loadProgress();
  if (!progress.startedAt) progress.startedAt = new Date().toISOString();
  const doneSet = new Set(progress.done);

  const todo = ids.filter((id) => !doneSet.has(id));
  console.log(`[refresh] ${todo.length} pending (skipping ${ids.length - todo.length} already done)`);

  let ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i++) {
    const id = todo[i];
    const tag = `[${i + 1}/${todo.length}] #${id}`;
    if (args.dryRun) {
      console.log(`${tag} DRY: would prewarm + refresh`);
      ok++;
      continue;
    }

    try {
      let prewarmInfo = null;
      if (args.prewarm) {
        const t0 = Date.now();
        prewarmInfo = await prewarmVercel(id);
        const ms = Date.now() - t0;
        console.log(`${tag} vercel ✓ ${prewarmInfo.ct} ${prewarmInfo.xv} ${prewarmInfo.len}b ${ms}ms`);
      }
      const t1 = Date.now();
      await refreshOpenSea(id);
      console.log(`${tag} opensea ✓ ${Date.now() - t1}ms`);
      progress.done.push(id);
      ok++;
    } catch (err) {
      console.error(`${tag} FAIL: ${err.message}`);
      progress.failed = (progress.failed || []).filter((x) => x !== id).concat(id);
      fail++;
    }

    saveProgress(progress);
    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n[refresh] done: ${ok}, failed: ${fail}`);
  if (progress.failed && progress.failed.length) {
    console.log(`[refresh] failed ids: ${progress.failed.join(',')}`);
    console.log(`[refresh] re-run to retry — failed entries are also added to "done" only on success`);
  }
}

main().catch((err) => {
  console.error('[refresh] fatal:', err);
  process.exit(1);
});

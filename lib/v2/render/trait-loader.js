// ============================================
// V2 Trait Loader — Load trait PNGs from KV → FS → HTTP
// ============================================
// Priority: KV cache (pre-rendered PNG) → local FS → HTTP from Vercel
// Goal: zero Resvg calls at runtime.

import fs from 'fs';
import path from 'path';
import { loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { kvGetBuffer, kvSetBuffer } from '../cache/kv-client.js';
import { traitPngKey, TTL } from '../cache/cache-keys.js';
import { BASE_URL } from '../shared/constants.js';

// In-memory PNG cache (per-process, avoids repeated KV roundtrips within same request lifetime)
const localPngCache = new Map();
const LOCAL_MAX = 200;

function localGet(key) {
  return localPngCache.get(key) || null;
}

function localSet(key, buffer) {
  if (localPngCache.size >= LOCAL_MAX) {
    const first = localPngCache.keys().next().value;
    localPngCache.delete(first);
  }
  localPngCache.set(key, buffer);
}

/**
 * Load a trait as a Canvas Image, using multiple fallback sources.
 * @param {string} category - Trait category (for KV key)
 * @param {string|number} traitId - Trait ID
 * @param {Object} options
 * @param {string} options.subdir - Subdirectory override (e.g. 'samuraizero', 'ogpunks')
 * @param {string} options.customPath - Full custom path relative to /public/
 * @returns {Promise<Image|null>}
 */
export async function loadTraitImage(category, traitId, { subdir = null, customPath = null } = {}) {
  const id = String(traitId);
  const kvKey = traitPngKey(category, id);

  // 1. In-memory process cache
  const localBuf = localGet(kvKey);
  if (localBuf) {
    return loadImage(localBuf);
  }

  // 2. KV (Upstash) — pre-rendered PNGs
  try {
    const kvBuf = await kvGetBuffer(kvKey);
    if (kvBuf) {
      localSet(kvKey, kvBuf);
      return loadImage(kvBuf);
    }
  } catch (err) {
    console.warn(`[trait-loader] KV get failed for ${kvKey}:`, err.message);
  }

  // 3. Local filesystem (SVG → convert to PNG on-demand, then cache)
  const pngBuffer = await loadFromFS(traitId, { subdir, customPath });
  if (pngBuffer) {
    localSet(kvKey, pngBuffer);
    // Fire-and-forget: persist to KV for next cold start
    kvSetBuffer(kvKey, pngBuffer, TTL.TRAIT_PNG).catch(() => {});
    return loadImage(pngBuffer);
  }

  // 4. HTTP fallback — fetch from Vercel
  const httpBuffer = await loadFromHTTP(traitId, { subdir, customPath });
  if (httpBuffer) {
    localSet(kvKey, httpBuffer);
    kvSetBuffer(kvKey, httpBuffer, TTL.TRAIT_PNG).catch(() => {});
    return loadImage(httpBuffer);
  }

  console.error(`[trait-loader] Failed to load trait ${category}/${traitId} from all sources`);
  return null;
}

/**
 * Load trait PNG from labimages (standard path) — wrapper for common case
 */
export async function loadTraitFromLabimages(traitId) {
  return loadTraitImage('LABIMG', traitId);
}

/**
 * Load a trait image from a specific path under /traits/ (category-organized)
 */
export async function loadTraitFromCategory(category, traitId) {
  return loadTraitImage(category, traitId, {
    customPath: `traits/${category}/${traitId}.svg`,
  });
}

// ===== INTERNAL LOADERS =====

async function loadFromFS(traitId, { subdir, customPath }) {
  const cwd = process.cwd();
  const paths = buildFSPaths(traitId, { subdir, customPath });

  for (const relPath of paths) {
    const fullPath = path.join(cwd, 'public', relPath);
    try {
      if (!fs.existsSync(fullPath)) continue;

      const ext = path.extname(fullPath).toLowerCase();
      if (ext === '.png') {
        return fs.readFileSync(fullPath);
      }
      if (ext === '.svg') {
        const svgContent = fs.readFileSync(fullPath, 'utf8');
        return svgToPng(svgContent);
      }
    } catch (err) {
      // Try next path
    }
  }
  return null;
}

async function loadFromHTTP(traitId, { subdir, customPath }) {
  const paths = buildHTTPPaths(traitId, { subdir, customPath });

  for (const url of paths) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) continue;

      const contentType = resp.headers.get('content-type') || '';
      const buffer = Buffer.from(await resp.arrayBuffer());

      if (contentType.includes('png') || url.endsWith('.png')) {
        return buffer;
      }
      if (contentType.includes('svg') || url.endsWith('.svg')) {
        return svgToPng(buffer.toString('utf8'));
      }
      // Unknown — try to use as PNG
      return buffer;
    } catch (err) {
      // Try next URL
    }
  }
  return null;
}

function buildFSPaths(traitId, { subdir, customPath }) {
  if (customPath) return [customPath];
  const id = String(traitId);
  const numId = parseInt(id);

  const paths = [];
  if (subdir) {
    paths.push(`labimages/${subdir}/${id}.svg`);
    paths.push(`labimages/${subdir}/${id}.png`);
  }
  // External URL traits (30000-35000) — no local fallback
  if (numId >= 30000 && numId <= 35000) return paths;
  // OG Punks
  if (numId >= 100001 && numId <= 101003) {
    paths.push(`labimages/ogpunks/${id}.svg`);
    paths.push(`labimages/ogpunks/${id}.png`);
  }
  // Standard labimages
  paths.push(`labimages/${id}.svg`);
  paths.push(`labimages/${id}.png`);
  return paths;
}

function buildHTTPPaths(traitId, { subdir, customPath }) {
  if (customPath) return [`${BASE_URL}/${customPath}`];
  const id = String(traitId);
  const numId = parseInt(id);

  const urls = [];
  if (subdir) {
    urls.push(`${BASE_URL}/labimages/${subdir}/${id}.svg`);
  }
  if (numId >= 30000 && numId <= 35000) {
    urls.push(`https://adrianzero.com/designs/${id}.svg`);
    return urls;
  }
  if (numId >= 100001 && numId <= 101003) {
    urls.push(`${BASE_URL}/labimages/ogpunks/${id}.svg`);
  }
  urls.push(`${BASE_URL}/labimages/${id}.svg`);
  return urls;
}

/**
 * Convert SVG content to PNG buffer using Resvg
 * This is the ONLY place Resvg is used in V2 (as fallback when pre-rendered PNGs don't exist)
 */
function svgToPng(svgContent) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: 1000 },
  });
  return resvg.render().asPng();
}

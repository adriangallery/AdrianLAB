// ============================================
// V2 Custom External Render — /api/v2/render/custom-external/[tokenId]
// ============================================
// Used by TraitLab to preview trait combinations before equipping.
// Accepts ?trait=340 (or multiple ?trait=340&trait=500) to override equipped traits.
// Also accepts ?CATEGORY=traitId directly (e.g. ?EYES=151).
//
// Reuses the full V2 compositor pipeline with trait overrides.

import fs from 'fs';
import path from 'path';
import { applyCors } from '../../../../../lib/v2/shared/cors.js';
import { fetchAllTokenData } from '../../../../../lib/v2/rpc/token-data-fetcher.js';
import { compositeToken } from '../../../../../lib/v2/render/compositor.js';
import { normalizeTraits } from '../../../../../lib/v2/render/layer-order.js';
import { generateCustomRenderHash } from '../../../../../lib/v2/shared/render-hash.js';
import { kvGetBuffer, kvSetBuffer } from '../../../../../lib/v2/cache/kv-client.js';
import { TTL } from '../../../../../lib/v2/cache/cache-keys.js';
import { CATEGORY_MAP } from '../../../../../lib/v2/shared/constants.js';

// JSON cache for trait mappings
const jsonCache = new Map();

function loadJsonFile(fileName) {
  if (jsonCache.has(fileName)) return jsonCache.get(fileName);
  try {
    const filePath = path.join(process.cwd(), 'public', 'labmetadata', fileName);
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    jsonCache.set(fileName, data);
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Build combined trait mapping from all metadata sources.
 * Maps traitId -> { category, name, fileName, isExternal, isOgpunk }
 */
function loadCombinedTraitsMapping() {
  if (jsonCache.has('_combined')) return jsonCache.get('_combined');

  const mapping = {};

  // 1. traits.json (base traits)
  const traitsData = loadJsonFile('traits.json');
  if (traitsData?.traits) {
    for (const trait of traitsData.traits) {
      if (trait && trait.category) {
        mapping[trait.tokenId] = {
          category: trait.category.toUpperCase(),
          name: trait.name || `Trait #${trait.tokenId}`,
          fileName: trait.fileName || `${trait.tokenId}.svg`,
        };
      }
    }
  }

  // 2. studio.json (external traits 30000-35000)
  const studioData = loadJsonFile('studio.json');
  if (studioData) {
    for (const [traitId, trait] of Object.entries(studioData)) {
      if (trait && trait.category) {
        mapping[traitId] = {
          category: trait.category.toUpperCase(),
          name: trait.name || `Studio Trait #${traitId}`,
          fileName: `${traitId}.svg`,
          isExternal: true,
        };
      }
    }
  }

  // 3. ogpunks.json
  const ogData = loadJsonFile('ogpunks.json');
  if (ogData?.traits) {
    for (const trait of ogData.traits) {
      if (trait) {
        mapping[trait.tokenId] = {
          category: (trait.category || 'TOP').toUpperCase(),
          name: trait.name || `OGPunk #${trait.tokenId}`,
          fileName: `${trait.tokenId}.svg`,
          isOgpunk: true,
        };
      }
    }
  }

  jsonCache.set('_combined', mapping);
  return mapping;
}

/**
 * Detect animated traits using filesystem (no HTTP self-calls).
 * Checks traits.json for Type:"Animated" and scans /public/labimages/ for variants.
 */
function detectAnimatedTraitsFs(traitIds) {
  const traitsData = loadJsonFile('traits.json');
  if (!traitsData?.traits) return [];

  const traitIdsNum = traitIds.map(id => parseInt(String(id)));
  const labimagesDir = path.join(process.cwd(), 'public', 'labimages');
  const result = [];

  for (const trait of traitsData.traits) {
    if (!traitIdsNum.includes(trait.tokenId) || trait.Type !== 'Animated') continue;

    const baseId = String(trait.tokenId);
    const variants = [];
    for (const letter of 'abcdefghij') {
      const variantPath = path.join(labimagesDir, `${baseId}${letter}.svg`);
      if (fs.existsSync(variantPath)) {
        variants.push(`${baseId}${letter}`);
      }
    }

    if (variants.length > 0) {
      result.push({
        baseId,
        name: trait.name,
        category: trait.category,
        variants,
        delay: 500,
      });
    }
  }

  return result;
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const start = Date.now();

  try {
    // === Parse tokenId ===
    let rawId = req.query.tokenId;
    if (rawId) rawId = rawId.replace(/\.(png|gif)$/i, '');
    const tokenId = parseInt(rawId);
    if (isNaN(tokenId) || tokenId < 0) {
      return res.status(400).json({ error: 'Invalid tokenId' });
    }

    const isCloseup = req.query.closeup === 'true';

    // === Load combined trait mapping ===
    const traitsMapping = loadCombinedTraitsMapping();

    // === Parse custom traits from query params ===
    const customTraits = {};

    // Direct category params (e.g. ?EYES=151)
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'tokenId' || key === 'png' || key === 'trait' || key === 'closeup'
          || key === 'bounce' || key === 'bounceDir' || key === 'bounceDist'
          || key === 'bounceCount' || key === 'bounceFrames' || key === 'bounceDelay') continue;
      const traitId = parseInt(value);
      if (!isNaN(traitId)) {
        customTraits[key.toUpperCase()] = String(traitId);
      }
    }

    // ?trait=340 params (resolve category from mapping)
    if (req.query.trait) {
      const traitValues = Array.isArray(req.query.trait) ? req.query.trait : [req.query.trait];
      const categoryConflicts = {};

      for (const traitValue of traitValues) {
        const traitId = parseInt(traitValue);
        if (isNaN(traitId)) continue;

        const info = traitsMapping[traitId];
        if (!info) {
          console.warn(`[v2/custom-external] Trait ${traitId} not found in mapping`);
          continue;
        }

        const category = CATEGORY_MAP[info.category] || info.category;
        if (!categoryConflicts[category]) categoryConflicts[category] = [];
        categoryConflicts[category].push({ id: traitId, info });
      }

      // Use last trait per category (same as V1)
      for (const [category, traits] of Object.entries(categoryConflicts)) {
        const last = traits[traits.length - 1];
        customTraits[category] = String(last.id);
      }
    }

    // === Fetch on-chain data (1 Multicall3 RPC) ===
    const tokenData = await fetchAllTokenData(tokenId);

    // === Merge equipped traits with custom overrides ===
    const equippedTraits = normalizeTraits(tokenData.categories, tokenData.traitIds);
    const mergedTraits = { ...equippedTraits, ...customTraits };

    // Build sorted trait IDs for cache key
    const allTraitIds = Object.values(mergedTraits).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);

    // === Detect animated traits (filesystem-based, no HTTP self-calls) ===
    const animatedTraits = detectAnimatedTraitsFs(allTraitIds);

    // === If animated traits present, delegate to V1 (proven GIF pipeline) ===
    if (animatedTraits.length > 0) {
      const { default: v1Handler } = await import('../../../render/custom-external/[tokenId].js');
      return v1Handler(req, res);
    }

    // === Cache key ===
    const hash = generateCustomRenderHash(tokenId, allTraitIds);
    const cacheKey = `v2:custom:${tokenId}:${hash}`;

    // === KV cache check ===
    const cached = await kvGetBuffer(cacheKey);
    if (cached) {
      return sendPng(res, cached, 'HIT', start);
    }

    // === Override tokenData categories/traitIds with merged traits ===
    const finalCategories = Object.keys(mergedTraits);
    const finalTraitIds = finalCategories.map(c => parseInt(mergedTraits[c]) || 0);

    const customTokenData = {
      ...tokenData,
      categories: finalCategories,
      traitIds: finalTraitIds,
    };

    // === Render ===
    const { buffer } = await compositeToken(customTokenData, {
      closeup: isCloseup,
    });

    // === Cache (shorter TTL for custom renders) ===
    kvSetBuffer(cacheKey, buffer, 600).catch(() => {}); // 10 min

    return sendPng(res, buffer, 'MISS', start);

  } catch (err) {
    console.error(`[v2/custom-external] Error:`, err);
    return res.status(500).json({ error: 'Custom render failed', message: err.message });
  }
}

function sendPng(res, buffer, cacheStatus, start) {
  const elapsed = Date.now() - start;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.setHeader('X-Cache', cacheStatus);
  res.setHeader('X-Render-Time', `${elapsed}ms`);
  res.setHeader('X-Version', 'ADRIANZERO-CUSTOM-V2');
  return res.status(200).send(buffer);
}

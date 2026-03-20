// ============================================
// V2 Metadata Builder — Construct JSON from Multicall3 data
// ============================================
// Zero additional RPC calls. All data comes from fetchAllTokenData().
// Output is 100% compatible with V1 metadata format.

import fs from 'fs';
import path from 'path';
import { resolveTokenName, resolveGeneration } from './name-resolver.js';
import { getSpecialTokenMetadata, isActionPack, getAnimationUrl } from './special-tokens.js';
import { getMetadataFile, TOGGLE_MAP, BASE_URL, TAG_CONFIGS } from '../shared/constants.js';

// JSON file cache (in-memory, loaded once per cold start)
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
    console.error(`[metadata-builder] Failed to load ${fileName}:`, err.message);
    return null;
  }
}

/**
 * Build the full metadata JSON for a token.
 * Output matches V1 format exactly for backward compatibility.
 *
 * @param {Object} tokenData - From fetchAllTokenData({ includeMetadata: true })
 * @param {Object} toggleEffects - Active toggle effects for this token
 * @returns {Promise<Object>} - OpenSea-compatible metadata JSON
 */
export async function buildMetadata(tokenData, toggleEffects = {}) {
  const { tokenId, tagInfo } = tokenData;
  const version = Date.now();

  // === Special tokens (early return) ===
  const special = getSpecialTokenMetadata(tokenId);
  if (special) return special;

  // === SamuraiZERO (special metadata) ===
  if (tagInfo?.tag === 'SamuraiZERO') {
    return buildSamuraiMetadata(tokenData);
  }

  // === Build image URL (V1 compatible: /api/render/ with ?v=timestamp) ===
  const imageUrl = buildImageUrl(tokenId, toggleEffects, version);

  // === Resolve name ===
  const equippedMap = buildEquippedMap(tokenData);
  const topTraitId = equippedMap['TOP'] || null;
  const name = resolveTokenName(tokenData, { topTraitId });

  // === Build attributes (V1 order: serum, generation, dup, skin, mutation, traits, toggle) ===
  const attributes = buildAttributes(tokenData, equippedMap, toggleEffects);

  // === Build response (V1 compatible format) ===
  const metadata = {
    name,
    description: 'An AdrianZero from the AdrianLAB collection',
    image: imageUrl,
    external_url: imageUrl,
    metadata_version: '2',
    attributes,
  };

  // Token 682 animation_url
  const animUrl = getAnimationUrl(tokenId);
  if (animUrl) metadata.animation_url = animUrl;

  return metadata;
}

// ===== ATTRIBUTE BUILDING (V1 compatible order) =====

function buildAttributes(tokenData, equippedMap, toggleEffects) {
  const attrs = [];

  // 1. UsedSerum (if any serum history exists)
  if (tokenData.serumHistory && tokenData.serumHistory.length > 0) {
    const lastSerum = tokenData.serumHistory[tokenData.serumHistory.length - 1];
    if (lastSerum.success) {
      attrs.push({ trait_type: 'UsedSerum', value: lastSerum.mutation || 'Unknown' });
    } else {
      attrs.push({ trait_type: 'UsedSerum', value: 'FAILED' });
    }
  }

  // 2. Generation (with SubZERO/SamuraiZERO override)
  const gen = resolveGeneration(tokenData);
  attrs.push({ trait_type: 'Generation', value: gen });

  // 3. DupGeneration (if duplicated)
  if (tokenData.dupInfo?.duplicated && tokenData.dupInfo.dupNumber > 0) {
    attrs.push({ trait_type: 'DupGeneration', value: `GEN${tokenData.dupInfo.dupNumber}` });
  }

  // 4. Skin
  if (tokenData.skinId === 0) {
    attrs.push({ trait_type: 'Skin', value: 'NOT_ASSIGNED' });
  } else {
    attrs.push({ trait_type: 'Skin', value: tokenData.skinName || 'Unknown' });
  }

  // 5. Mutation attributes (ALL THREE when canReplicate is true — V1 uses tokenData[2])
  if (tokenData.canReplicate) {
    attrs.push(
      { trait_type: 'Mutation Level', value: String(tokenData.mutationLevel) },
      { trait_type: 'Mutation Type', value: String(tokenData.replicationCount) },
      { trait_type: 'Mutation Stage', value: String(tokenData.lastReplication || 0) }
    );
  }

  // 6. Equipped traits with names from labmetadata JSON
  const traitNames = resolveTraitNames(tokenData.categories, tokenData.traitIds, tokenData.tokenId);
  for (const { category, traitName } of traitNames) {
    attrs.push({ trait_type: category, value: traitName });
  }

  // 7. Toggle (if any active)
  const activeEffects = [];
  if (toggleEffects.closeup) activeEffects.push('CLOSEUP');
  if (toggleEffects.shadow) activeEffects.push('SHADOW');
  if (toggleEffects.glow) activeEffects.push('GLOW');
  if (toggleEffects.bn) activeEffects.push('BN');
  if (toggleEffects.uv) activeEffects.push('UV');
  if (toggleEffects.blackout) activeEffects.push('BLACKOUT');
  if (toggleEffects.banana) activeEffects.push('BANANA');

  if (activeEffects.length > 0) {
    attrs.push({ trait_type: 'Toggle', value: activeEffects.join(', ') });
  }

  return attrs;
}

function resolveTraitNames(categories, traitIds, tokenId) {
  const result = [];
  if (!categories || categories.length === 0) return result;

  const numId = parseInt(tokenId);
  const { file, key } = getMetadataFile(numId);
  const jsonData = loadJsonFile(file);
  if (!jsonData) return result;

  // V1 uses .traits array and looks up by tokenId field
  const traitsArray = key ? jsonData[key] : Object.values(jsonData);

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const traitId = traitIds[i];

    // V1 lookup: traitsData.traits.find(t => t.tokenId === parseInt(traitId))
    let traitName = `#${traitId}`;
    if (Array.isArray(traitsArray)) {
      const entry = traitsArray.find(t =>
        parseInt(t.tokenId) === parseInt(traitId) ||
        parseInt(t.id) === parseInt(traitId) ||
        parseInt(t.traitId) === parseInt(traitId)
      );
      if (entry) {
        traitName = entry.name || entry.traitName || `#${traitId}`;
      }
    }

    result.push({ category, traitName });
  }

  return result;
}

// ===== HELPERS =====

function buildEquippedMap(tokenData) {
  const map = {};
  tokenData.categories.forEach((cat, idx) => {
    map[cat] = String(tokenData.traitIds[idx]);
  });
  return map;
}

function buildImageUrl(tokenId, toggleEffects, version) {
  // V1 format: /api/render/{tokenId}.png?toggle_params&v=timestamp
  const params = [];
  if (toggleEffects.closeup) params.push('closeup=true');
  if (toggleEffects.shadow) params.push('shadow=true');
  if (toggleEffects.glow) params.push('glow=true');
  if (toggleEffects.bn) params.push('bn=true');
  if (toggleEffects.uv) params.push('uv=true');
  if (toggleEffects.blackout) params.push('blackout=true');
  if (toggleEffects.banana) params.push('banana=true');
  params.push(`v=${version}`);

  return `${BASE_URL}/api/render/${tokenId}.png?${params.join('&')}`;
}

async function buildSamuraiMetadata(tokenData) {
  const { tokenId } = tokenData;

  // Load SamuraiZERO metadata
  const samuraiData = loadJsonFile('samuraimetadata.json');
  if (!samuraiData) {
    return buildFallbackSamuraiMetadata(tokenId);
  }

  const entries = Array.isArray(samuraiData) ? samuraiData : (samuraiData.samurai || []);
  const entry = entries.find(e => String(e.tokenId || e.id) === String(tokenId));

  if (!entry) {
    return buildFallbackSamuraiMetadata(tokenId);
  }

  return {
    name: entry.name ? `${entry.name} #${tokenId}` : `SamuraiZERO #${tokenId}`,
    description: entry.description || 'An AdrianZero from the AdrianLAB collection',
    image: `${BASE_URL}/api/render/${tokenId}.png?v=${Date.now()}`,
    external_url: `${BASE_URL}/api/render/${tokenId}.png?v=${Date.now()}`,
    metadata_version: '2',
    attributes: [
      { trait_type: 'Generation', value: 'SamuraiZERO' },
      ...(entry.attributes || []),
    ],
  };
}

function buildFallbackSamuraiMetadata(tokenId) {
  return {
    name: `SamuraiZERO #${tokenId}`,
    description: 'An AdrianZero from the AdrianLAB collection',
    image: `${BASE_URL}/api/render/${tokenId}.png?v=${Date.now()}`,
    external_url: `${BASE_URL}/api/render/${tokenId}.png?v=${Date.now()}`,
    metadata_version: '2',
    attributes: [
      { trait_type: 'Generation', value: 'SamuraiZERO' },
    ],
  };
}

// ============================================
// V2 Metadata Builder — Construct JSON from Multicall3 data
// ============================================
// Zero additional RPC calls. All data comes from fetchAllTokenData().

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
 *
 * @param {Object} tokenData - From fetchAllTokenData({ includeMetadata: true })
 * @param {Object} toggleEffects - Active toggle effects for this token
 * @returns {Promise<Object>} - OpenSea-compatible metadata JSON
 */
export async function buildMetadata(tokenData, toggleEffects = {}) {
  const { tokenId, tagInfo } = tokenData;

  // === Special tokens (early return) ===
  const special = getSpecialTokenMetadata(tokenId);
  if (special) return special;

  // === SamuraiZERO (special metadata) ===
  if (tagInfo?.tag === 'SamuraiZERO') {
    return buildSamuraiMetadata(tokenData);
  }

  // === Build image URL ===
  const imageUrl = buildImageUrl(tokenId, toggleEffects);

  // === Resolve name ===
  const equippedMap = buildEquippedMap(tokenData);
  const topTraitId = equippedMap['TOP'] || null;

  // For SamuraiZERO index, we'd need it from tokenData
  const name = resolveTokenName(tokenData, { topTraitId });

  // === Build attributes ===
  const attributes = buildAttributes(tokenData, equippedMap, toggleEffects);

  // === Build response ===
  const metadata = {
    name,
    description: 'AdrianZERO — Evolving PFP NFT on Base',
    image: imageUrl,
    external_url: `https://adrianzero.com/token/${tokenId}`,
    metadata_version: '2',
    attributes,
  };

  // Token 682 animation_url
  const animUrl = getAnimationUrl(tokenId);
  if (animUrl) metadata.animation_url = animUrl;

  return metadata;
}

// ===== ATTRIBUTE BUILDING =====

function buildAttributes(tokenData, equippedMap, toggleEffects) {
  const attrs = [];

  // 1. Serum (if any history)
  if (tokenData.serumHistory && tokenData.serumHistory.length > 0) {
    const lastSerum = tokenData.serumHistory[tokenData.serumHistory.length - 1];
    if (lastSerum.success) {
      attrs.push({ trait_type: 'UsedSerum', value: lastSerum.mutation || 'Unknown' });
    } else {
      attrs.push({ trait_type: 'UsedSerum', value: 'FAILED' });
    }
  }

  // 2. Generation
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

  // 5. Mutation attributes (if canReplicate)
  if (tokenData.canReplicate) {
    attrs.push({ trait_type: 'Mutation Level', value: String(tokenData.mutationLevel) });
  }

  // 6. Equipped traits with names
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
  const numId = parseInt(tokenId);
  const { file, key } = getMetadataFile(numId);
  const jsonData = loadJsonFile(file);
  if (!jsonData) return result;

  const traitsArray = key ? jsonData[key] : Object.values(jsonData);

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    const traitId = traitIds[i];

    // Find trait name from metadata
    let traitName = String(traitId);
    if (traitsArray) {
      const entry = Array.isArray(traitsArray)
        ? traitsArray.find(t => String(t.id || t.tokenId || t.traitId) === String(traitId))
        : null;
      if (entry) {
        traitName = entry.name || entry.traitName || String(traitId);
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

function buildImageUrl(tokenId, toggleEffects) {
  const params = [];
  if (toggleEffects.closeup) params.push('closeup=true');
  if (toggleEffects.shadow) params.push('shadow=true');
  if (toggleEffects.glow) params.push('glow=true');
  if (toggleEffects.bn) params.push('bn=true');
  if (toggleEffects.uv) params.push('uv=true');
  if (toggleEffects.blackout) params.push('blackout=true');
  if (toggleEffects.banana) params.push('banana=true');

  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  const ext = '.png';
  return `${BASE_URL}/api/v2/render/${tokenId}${ext}${qs}`;
}

async function buildSamuraiMetadata(tokenData) {
  const { tokenId } = tokenData;

  // Load SamuraiZERO metadata
  const samuraiData = loadJsonFile('samuraimetadata.json');
  if (!samuraiData) {
    return buildFallbackSamuraiMetadata(tokenId);
  }

  // Get SamuraiZERO index
  // We need to look up the token in the sorted list
  // For now, find by tokenId in the array
  const entries = Array.isArray(samuraiData) ? samuraiData : (samuraiData.samurai || []);
  const entry = entries.find(e => String(e.tokenId || e.id) === String(tokenId));

  if (!entry) {
    return buildFallbackSamuraiMetadata(tokenId);
  }

  return {
    name: entry.name ? `${entry.name} #${tokenId}` : `SamuraiZERO #${tokenId}`,
    description: entry.description || 'SamuraiZERO — Legendary warrior of the AdrianZERO ecosystem',
    image: `${BASE_URL}/api/v2/render/${tokenId}.png`,
    external_url: `https://adrianzero.com/token/${tokenId}`,
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
    description: 'SamuraiZERO — Legendary warrior of the AdrianZERO ecosystem',
    image: `${BASE_URL}/api/v2/render/${tokenId}.png`,
    external_url: `https://adrianzero.com/token/${tokenId}`,
    metadata_version: '2',
    attributes: [
      { trait_type: 'Generation', value: 'SamuraiZERO' },
    ],
  };
}

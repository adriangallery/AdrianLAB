// ============================================
// V2 Tag Resolver — SubZERO, SamuraiZERO
// ============================================
// Resolves tag info from Multicall3 data and provides
// index lookup for SamuraiZERO tokens.

import { multicall } from '../rpc/multicall.js';
import { CONTRACTS, TAG_CONFIGS } from '../shared/constants.js';
import { encodeGetTokensByTag } from '../rpc/contracts.js';
import { kvGet, kvSet } from '../cache/kv-client.js';
import { samuraiListKey, TTL } from '../cache/cache-keys.js';

/**
 * Get the SamuraiZERO index for a token.
 * Index is based on sorted order of all SamuraiZERO token IDs.
 *
 * @param {number} tokenId
 * @returns {Promise<number|null>} - 0-599 index or null
 */
export async function getSamuraiIndex(tokenId) {
  const sortedIds = await getSamuraiSortedList();
  if (!sortedIds || sortedIds.length === 0) return 0; // fallback

  const index = sortedIds.indexOf(tokenId);
  if (index !== -1) return index;

  // Token not in list but confirmed SamuraiZERO — calculate position
  const allIds = [...sortedIds, tokenId].sort((a, b) => a - b);
  return Math.min(allIds.indexOf(tokenId), 599);
}

/**
 * Get sorted list of all SamuraiZERO token IDs.
 * Merges two deployer sources so the ordinal index stays consistent after
 * mints migrated from BatchDeployer to the $ZERO Diamond SamuraiMintFacet.
 * Cached in KV for 1 minute (new mints can change order).
 */
async function getSamuraiSortedList() {
  const cached = await kvGet(samuraiListKey());
  if (cached) return cached;

  try {
    const results = await multicall([
      encodeGetTokensByTag(CONTRACTS.BATCH_DEPLOYER, 'SamuraiZERO'),
      encodeGetTokensByTag(CONTRACTS.ZERO_DIAMOND, 'SamuraiZERO'),
    ]);

    const merged = new Set();
    for (const r of results) {
      if (!r.success) continue;
      const ids = r.data[0] || [];
      for (const id of ids) merged.add(Number(id));
    }

    const sortedIds = Array.from(merged).sort((a, b) => a - b);

    await kvSet(samuraiListKey(), sortedIds, TTL.SAMURAI_INDEX);
    return sortedIds;
  } catch (err) {
    console.error('[tag-resolver] Failed to fetch SamuraiZERO list:', err.message);
    return [];
  }
}

/**
 * Apply tag-specific trait modifications.
 * Returns modified traits object.
 *
 * @param {Object} traits - Normalized equipped traits
 * @param {Object} tagInfo - { tag, deployer, isMinted }
 * @returns {Object} - Modified traits
 */
export function applyTagTraits(traits, tagInfo) {
  if (!tagInfo?.tag) return traits;

  if (tagInfo.tag === 'SubZERO') {
    const config = TAG_CONFIGS.SubZERO;
    const modified = { ...traits };

    // Filter EYES
    if (modified['EYES'] && !config.allowedEyesTraits.includes(parseInt(modified['EYES']))) {
      delete modified['EYES'];
    }

    // Force SKINTRAIT
    modified['SKINTRAIT'] = String(config.forcedSkinTrait);
    return modified;
  }

  return traits;
}

// ============================================
// V2 Tag Resolver — SubZERO, SamuraiZERO, GumballZERO
// ============================================
// Resolves tag info from Multicall3 data and provides
// index lookup for SamuraiZERO tokens.
// GumballZERO: lookup en gums.json por tokenId, double-via detection.

import fs from 'fs';
import path from 'path';
import { multicall } from '../rpc/multicall.js';
import { CONTRACTS, TAG_CONFIGS, GUMBALL_ID_RANGE } from '../shared/constants.js';
import { encodeGetTokensByTag } from '../rpc/contracts.js';
import { kvGet, kvSet, kvDel } from '../cache/kv-client.js';
import { samuraiListKey, TTL } from '../cache/cache-keys.js';

// ============================================================
// GUMBALL — in-memory cache del JSON (cold start: carga una vez)
// ============================================================
let _gumsData = null;
function loadGumsData() {
  if (_gumsData) return _gumsData;
  try {
    const filePath = path.join(process.cwd(), 'public', 'labmetadata', 'gums.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    _gumsData = JSON.parse(raw);
  } catch (err) {
    console.error('[tag-resolver] Failed to load gums.json:', err.message);
    _gumsData = { gums: [] };
  }
  return _gumsData;
}

/**
 * Detects if a tokenId belongs to the GumballZERO collection.
 *
 * PRIMARY (production): onChainTag === 'GumballZERO'
 *   Resolved by GumballMintFacet via gumballWasMintedHere / gumballGetTokenTag.
 *   Tags are assigned at seed time so every tokenId in the batch carries the tag
 *   from mint. TokenIds are NON-CONTIGUOUS (interleaved with other mints in the
 *   global AdrianZERO counter), so range-based detection is NOT reliable on-chain.
 *
 * FALLBACK (local render / prewarm only): GUMBALL_ID_RANGE numeric range.
 *   Valid only while the placeholder range 9001–9100 is in use for local testing.
 *   This fallback is intentionally NOT the production path and will become a no-op
 *   once GUMBALL_ID_RANGE is reconciled to the real minted IDs post-premint (F5).
 *
 * @param {number} tokenId
 * @param {string|null} onChainTag - tag resolved on-chain by token-data-fetcher
 * @returns {boolean}
 */
export function isGumballToken(tokenId, onChainTag = null) {
  // PRIMARY: on-chain tag from GumballMintFacet (production path)
  if (onChainTag === 'GumballZERO') return true;
  // FALLBACK: placeholder range for local render/prewarm only — NOT production
  const n = parseInt(tokenId);
  return n >= GUMBALL_ID_RANGE.start && n <= GUMBALL_ID_RANGE.end;
}

/**
 * Get the GumballZERO entry for a tokenId.
 * Returns the gums.json entry with traits parsed as array.
 *
 * @param {number} tokenId
 * @returns {{ tokenId, name, traitIds: number[], description, masterminds, external_url } | null}
 */
export function getGumballTraits(tokenId) {
  const data = loadGumsData();
  const entry = data.gums.find(g => parseInt(g.tokenId) === parseInt(tokenId));
  if (!entry) return null;

  let traitIds;
  try {
    traitIds = JSON.parse(entry.traits);
  } catch (e) {
    console.error('[tag-resolver] Failed to parse gumball traits for', tokenId, e.message);
    traitIds = [];
  }

  return {
    tokenId: entry.tokenId,
    name: entry.name,
    traitIds,
    description: entry.description,
    masterminds: entry.masterminds,
    external_url: entry.external_url,
  };
}

/**
 * Get the SamuraiZERO index for a token.
 * Index is based on sorted order of all SamuraiZERO token IDs.
 *
 * @param {number} tokenId
 * @returns {Promise<number|null>} - 0-599 index or null
 */
export async function getSamuraiIndex(tokenId) {
  let sortedIds = await getSamuraiSortedList();

  let index = sortedIds.indexOf(tokenId);
  if (index !== -1) return index;

  // Cache miss: token was minted after last KV snapshot.
  // Force-refresh once to avoid the race where concurrent new mints all
  // collapse onto the same "last position" index from a stale list.
  await kvDel(samuraiListKey());
  sortedIds = await getSamuraiSortedList();
  index = sortedIds.indexOf(tokenId);
  if (index !== -1) return index;

  // Still not in list (RPC lag / genuinely new) — use calculated position.
  if (sortedIds.length === 0) return 0;
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

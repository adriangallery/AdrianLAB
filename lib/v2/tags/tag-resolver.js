// ============================================
// V2 Tag Resolver — SubZERO, SamuraiZERO, GumballZERO
// ============================================
// Resolves tag info from Multicall3 data and provides
// index lookup for SamuraiZERO and GumballZERO tokens.
//
// GumballZERO architecture (mint-on-demand, tokenIds non-contiguous):
//   Detection: on-chain tag 'GumballZERO' via GumballMintFacet (production).
//   Index: sort getTokensByTag(Diamond, 'GumballZERO') ascending → position = gums.json ordinal.
//   gums.json format: { collection: [ entry0, entry1, ... ] } (0-based ordinal).
//   Analogous to SamuraiZERO / getSamuraiIndex — no range-based detection.

import fs from 'fs';
import path from 'path';
import { multicall } from '../rpc/multicall.js';
import { CONTRACTS, TAG_CONFIGS } from '../shared/constants.js';
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
    _gumsData = { collection: [] };
  }
  return _gumsData;
}

/**
 * Detects if a tokenId belongs to the GumballZERO collection.
 * Production path: on-chain tag 'GumballZERO' only.
 * TokenIds are NON-CONTIGUOUS — no range fallback.
 *
 * @param {number} tokenId
 * @param {string|null} onChainTag - tag resolved on-chain by token-data-fetcher
 * @returns {boolean}
 */
export function isGumballToken(tokenId, onChainTag = null) {
  return onChainTag === 'GumballZERO';
}

/**
 * Get the GumballZERO entry for a token by its ordinal index in gums.json.
 * Index is derived from getGumballIndex() — position in sorted on-chain list.
 *
 * @param {number} gumballIndex - 0-based ordinal (first minted = 0)
 * @returns {{ name, traitIds: number[], description, masterminds, external_url } | null}
 */
export function getGumballTraits(gumballIndex) {
  const data = loadGumsData();
  const collection = data.collection || [];
  const entry = collection[gumballIndex];
  if (!entry) return null;

  let traitIds;
  try {
    traitIds = JSON.parse(entry.traits);
  } catch (e) {
    console.error('[tag-resolver] Failed to parse gumball traits at index', gumballIndex, e.message);
    traitIds = [];
  }

  return {
    name: entry.name,
    traitIds,
    description: entry.description,
    masterminds: entry.masterminds,
    external_url: entry.external_url,
  };
}

/**
 * Get the ordinal index for a GumballZERO token.
 * Index = position of tokenId in sorted ascending list of all GumballZERO tokenIds.
 * Mirrors getSamuraiIndex exactly, but sourced from ZERO_DIAMOND only.
 *
 * @param {number} tokenId
 * @returns {Promise<number|null>} - 0-based index (0..99) or null if not found
 */
export async function getGumballIndex(tokenId) {
  let sortedIds = await getGumballSortedList();

  let index = sortedIds.indexOf(tokenId);
  if (index !== -1) return index;

  // Cache miss: token freshly minted — force refresh once (race guard)
  await kvDel(gumballListKey());
  sortedIds = await getGumballSortedList();
  index = sortedIds.indexOf(tokenId);
  if (index !== -1) return index;

  // Still not found (RPC lag / genuinely new) — estimate from sorted position
  if (sortedIds.length === 0) return 0;
  const allIds = [...sortedIds, tokenId].sort((a, b) => a - b);
  return Math.min(allIds.indexOf(tokenId), 99);
}

/**
 * Get sorted ascending list of all GumballZERO tokenIds from on-chain.
 * Cached in KV for 1 minute (new mints can change order).
 */
async function getGumballSortedList() {
  const cached = await kvGet(gumballListKey());
  if (cached) return cached;

  try {
    const results = await multicall([
      encodeGetTokensByTag(CONTRACTS.ZERO_DIAMOND, 'GumballZERO'),
    ]);

    const ids = new Set();
    for (const r of results) {
      if (!r.success) continue;
      for (const id of (r.data[0] || [])) ids.add(Number(id));
    }

    const sortedIds = Array.from(ids).sort((a, b) => a - b);
    await kvSet(gumballListKey(), sortedIds, TTL.SAMURAI_INDEX); // same 60s TTL
    return sortedIds;
  } catch (err) {
    console.error('[tag-resolver] Failed to fetch GumballZERO list:', err.message);
    return [];
  }
}

/** KV key for the GumballZERO sorted list */
function gumballListKey() {
  return 'v2:gumball:list';
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

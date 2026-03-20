// ============================================
// V2 Toggle Store — Toggle state in KV
// ============================================
// Loads all active toggles from ZoomInZEROS contract, caches in KV.
// Designed to be called by a cron job (24h), not per-request.

import { multicall } from '../rpc/multicall.js';
import { encodeGetAllActiveToggles } from '../rpc/contracts.js';
import { kvGet, kvSet } from './kv-client.js';
import { togglesKey, TTL } from './cache-keys.js';
import { TOGGLE_MAP } from '../shared/constants.js';

// In-memory fallback (populated on first load)
let memToggles = null;
let memTimestamp = 0;

/**
 * Get the active toggle effects for a specific token.
 * Returns an object like { closeup: true, shadow: true, ... } or empty object.
 *
 * @param {number|string} tokenId
 * @returns {Promise<Object>}
 */
export async function getTokenToggleEffects(tokenId) {
  const toggleMap = await loadToggles();
  if (!toggleMap) return {};

  const tokenIdStr = String(tokenId);
  const toggleIds = toggleMap[tokenIdStr];
  if (!toggleIds || toggleIds.length === 0) return {};

  // Merge all active toggle effects
  const effects = {};
  for (const toggleId of toggleIds) {
    const mapping = TOGGLE_MAP[String(toggleId)];
    if (mapping) {
      Object.assign(effects, mapping);
    }
  }
  return effects;
}

/**
 * Check if a specific toggle is active for a token
 */
export async function hasToggle(tokenId, toggleId) {
  const toggleMap = await loadToggles();
  if (!toggleMap) return false;

  const toggleIds = toggleMap[String(tokenId)];
  return toggleIds ? toggleIds.includes(Number(toggleId)) : false;
}

/**
 * Load toggle map from KV → chain fallback.
 * Returns { tokenId: [toggleId, ...] }
 */
async function loadToggles() {
  // In-memory cache (5 min within same process)
  if (memToggles && (Date.now() - memTimestamp) < 5 * 60 * 1000) {
    return memToggles;
  }

  // Try KV
  const cached = await kvGet(togglesKey());
  if (cached) {
    memToggles = cached;
    memTimestamp = Date.now();
    return cached;
  }

  // Fetch from chain
  return refreshToggles();
}

/**
 * Refresh toggles from chain → KV.
 * Call this from a cron or on first request.
 */
export async function refreshToggles() {
  try {
    const [result] = await multicall([encodeGetAllActiveToggles()]);

    if (!result.success) {
      console.warn('[toggle-store] getAllActiveToggles failed:', result.error);
      return memToggles || {};
    }

    const rawToggles = result.data[0] || [];
    const toggleMap = {};

    for (const toggle of rawToggles) {
      const tokenId = String(Number(toggle.tokenId || toggle[0]));
      const toggleId = Number(toggle.toggleId || toggle[1]);

      if (!toggleMap[tokenId]) toggleMap[tokenId] = [];
      toggleMap[tokenId].push(toggleId);
    }

    // Save to KV and memory
    await kvSet(togglesKey(), toggleMap, TTL.TOGGLES);
    memToggles = toggleMap;
    memTimestamp = Date.now();

    console.log(`[toggle-store] Loaded ${rawToggles.length} active toggles for ${Object.keys(toggleMap).length} tokens`);
    return toggleMap;
  } catch (err) {
    console.error('[toggle-store] Failed to refresh toggles:', err.message);
    return memToggles || {};
  }
}

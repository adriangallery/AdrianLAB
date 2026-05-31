// ============================================
// V2 Provider — Singleton with fallback chain
// ============================================

import { getProvider as getRotatingProvider } from '../../contracts.js';

/**
 * Get a connected provider (singleton).
 *
 * Now delegates to the shared rotating pool in lib/contracts.js (RPC_URLS +
 * ALCHEMY_* + base.org floor, with per-endpoint bans + runtime failover).
 *
 * The previous implementation health-checked each URL with getNetwork(), but
 * because a static network is passed, getNetwork() never actually probes — so a
 * dead Alchemy URL "passed" and was used until calls failed, with no failover.
 * The rotator bans a bad endpoint on the real call error and rotates instead.
 * @returns {Promise<ethers.providers.JsonRpcProvider>}
 */
export async function getProvider() {
  return getRotatingProvider();
}

/**
 * Reset is a no-op now — the rotator manages endpoint health internally.
 */
export function resetProvider() {}

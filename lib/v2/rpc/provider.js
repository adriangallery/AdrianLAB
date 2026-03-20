// ============================================
// V2 Provider — Singleton with fallback chain
// ============================================

import { ethers } from 'ethers';
import { getRpcUrls, BASE_CHAIN } from '../shared/constants.js';

let cachedProvider = null;
let providerPromise = null;

/**
 * Get a connected provider (singleton, lazy init)
 * Tries each RPC in order until one works.
 * @returns {Promise<ethers.providers.JsonRpcProvider>}
 */
export async function getProvider() {
  if (cachedProvider) return cachedProvider;

  // Prevent duplicate init during concurrent requests
  if (providerPromise) return providerPromise;

  providerPromise = initProvider();
  cachedProvider = await providerPromise;
  providerPromise = null;
  return cachedProvider;
}

async function initProvider() {
  const urls = getRpcUrls();

  for (const url of urls) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url, BASE_CHAIN);
      await provider.getNetwork();
      const label = url.includes('alchemy') ? 'Alchemy'
        : url.includes('infura') ? 'Infura'
        : 'Base RPC';
      console.log(`[v2/provider] Connected via ${label}`);
      return provider;
    } catch (err) {
      console.warn(`[v2/provider] Failed: ${url.substring(0, 55)}... — ${err.message}`);
    }
  }

  // Last resort — return Base public RPC without health check
  console.warn('[v2/provider] All RPCs failed, using Base public as last resort');
  return new ethers.providers.JsonRpcProvider('https://mainnet.base.org', BASE_CHAIN);
}

/**
 * Reset the cached provider (e.g. after detecting a stale connection)
 */
export function resetProvider() {
  cachedProvider = null;
  providerPromise = null;
}

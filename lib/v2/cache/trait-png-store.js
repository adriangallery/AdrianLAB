// ============================================
// V2 Trait PNG Store — Bulk pre-render operations
// ============================================
// Used by scripts/prerender-traits.js to populate KV with PNGs.

import { kvSetBuffer, kvGetBuffer, kvExists } from './kv-client.js';
import { traitPngKey, TTL } from './cache-keys.js';

/**
 * Store a pre-rendered trait PNG in KV
 * @param {string} category - Category name (for key)
 * @param {string|number} traitId - Trait ID
 * @param {Buffer} pngBuffer - PNG image data
 */
export async function storeTraitPng(category, traitId, pngBuffer) {
  const key = traitPngKey(category, String(traitId));
  await kvSetBuffer(key, pngBuffer, TTL.TRAIT_PNG);
}

/**
 * Check if a trait PNG already exists in KV
 */
export async function traitPngExists(category, traitId) {
  const key = traitPngKey(category, String(traitId));
  return kvExists(key);
}

/**
 * Get a trait PNG from KV
 */
export async function getTraitPng(category, traitId) {
  const key = traitPngKey(category, String(traitId));
  return kvGetBuffer(key);
}

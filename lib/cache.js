// Cache system to optimize renders
const memoryCache = new Map();

/**
 * Gets a cached result
 * @param {string} key - Cache key
 * @returns {any} - Cached result or null if it doesn't exist
 */
export function getCachedResult(key) {
  if (!memoryCache.has(key)) return null;
  
  const { value, expiry } = memoryCache.get(key);
  
  if (expiry < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  
  return value;
}

/**
 * Saves a result in the cache
 * @param {string} key - Cache key
 * @param {any} value - Value to save
 * @param {number} ttlMs - Time to live in milliseconds (default 1 hour)
 */
export function setCachedResult(key, value, ttlMs = 3600000) {
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlMs
  });
}

/**
 * Gets a cached render
 * @param {string|number} tokenId - Token ID
 * @returns {Promise<string|null>} - Rendered SVG or null if not in cache
 */
export async function getCachedRender(tokenId) {
  return getCachedResult(`render_${tokenId}`);
}

/**
 * Saves a render in the cache
 * @param {string|number} tokenId - Token ID
 * @param {string} svg - Rendered SVG
 */
export function setCachedRender(tokenId, svg) {
  setCachedResult(`render_${tokenId}`, svg);
}

export function clearCache() {
  memoryCache.clear();
}

export function getCacheStats() {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys())
  };
}
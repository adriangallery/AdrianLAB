// Sistema de caché para optimizar renders
const memoryCache = new Map();

/**
 * Obtiene un resultado en caché
 * @param {string} key - Clave de caché
 * @returns {any} - Resultado en caché o null si no existe
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
 * Guarda un resultado en caché
 * @param {string} key - Clave de caché
 * @param {any} value - Valor a guardar
 * @param {number} ttlMs - Tiempo de vida en milisegundos (por defecto 1 hora)
 */
export function setCachedResult(key, value, ttlMs = 3600000) {
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlMs
  });
}

/**
 * Obtiene un render en caché
 * @param {string|number} tokenId - ID del token
 * @returns {Promise<string|null>} - SVG renderizado o null si no está en caché
 */
export async function getCachedRender(tokenId) {
  return getCachedResult(`render_${tokenId}`);
}

/**
 * Guarda un render en caché
 * @param {string|number} tokenId - ID del token
 * @param {string} svg - SVG renderizado
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
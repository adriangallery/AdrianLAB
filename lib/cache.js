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

// ===== FUNCIONES ESPECÍFICAS PARA FLOPPY METADATA =====

/**
 * Obtiene el TTL específico para floppy metadata según el tipo de token
 * @param {number} tokenId - Token ID
 * @returns {number} - TTL en millisegundos
 */
export function getFloppyMetadataTTL(tokenId) {
  const tokenIdNum = parseInt(tokenId);
  
  if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
    // Traits - 24 horas
    return 86400000; // 24 * 60 * 60 * 1000
  } else if (tokenIdNum >= 10000 && tokenIdNum <= 15500) {
    // Floppys - 48 horas
    return 172800000; // 48 * 60 * 60 * 1000
  } else if (tokenIdNum === 262144) {
    // Serum - 48 horas
    return 172800000; // 48 * 60 * 60 * 1000
  } else {
    // Fallback - 1 hora
    return 3600000; // 1 * 60 * 60 * 1000
  }
}

/**
 * Obtiene metadata de floppy desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {object|null} - Metadata cacheada o null
 */
export function getCachedFloppyMetadata(tokenId) {
  return getCachedResult(`floppy_metadata_${tokenId}`);
}

/**
 * Guarda metadata de floppy en caché
 * @param {string|number} tokenId - Token ID
 * @param {object} metadata - Metadata a cachear
 */
export function setCachedFloppyMetadata(tokenId, metadata) {
  const ttl = getFloppyMetadataTTL(tokenId);
  setCachedResult(`floppy_metadata_${tokenId}`, metadata, ttl);
}

/**
 * Invalida caché de floppy metadata por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateFloppyMetadata(tokenId) {
  const key = `floppy_metadata_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated floppy metadata for token ${tokenId}`);
    return true;
  }
  return false;
}

/**
 * Invalida caché de floppy metadata por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateFloppyMetadataRange(startId, endId) {
  let invalidated = 0;
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateFloppyMetadata(tokenId)) {
      invalidated++;
    }
  }
  console.log(`[cache] Invalidated ${invalidated} floppy metadata entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Invalida todo el caché de floppy metadata
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAllFloppyMetadata() {
  let invalidated = 0;
  const keysToDelete = [];
  
  for (const key of memoryCache.keys()) {
    if (key.startsWith('floppy_metadata_')) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => {
    memoryCache.delete(key);
    invalidated++;
  });
  
  console.log(`[cache] Invalidated all floppy metadata (${invalidated} entries)`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de floppy metadata
 * @returns {object} - Estadísticas del caché
 */
export function getFloppyMetadataCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const floppyKeys = allKeys.filter(key => key.startsWith('floppy_metadata_'));
  
  const stats = {
    total: floppyKeys.length,
    traits: 0,
    floppys: 0,
    serums: 0,
    others: 0,
    keys: floppyKeys
  };
  
  floppyKeys.forEach(key => {
    const tokenId = parseInt(key.replace('floppy_metadata_', ''));
    
    if (tokenId >= 1 && tokenId <= 9999) {
      stats.traits++;
    } else if (tokenId >= 10000 && tokenId <= 15500) {
      stats.floppys++;
    } else if (tokenId === 262144) {
      stats.serums++;
    } else {
      stats.others++;
    }
  });
  
  return stats;
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
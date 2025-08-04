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

// ===== FUNCIONES ESPECÍFICAS PARA FLOPPY RENDER =====

/**
 * Obtiene el TTL específico para floppy render según el tipo de token
 * @param {number} tokenId - Token ID
 * @returns {number} - TTL en millisegundos
 */
export function getFloppyRenderTTL(tokenId) {
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
 * Obtiene render de floppy desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {Buffer|null} - Imagen cacheada o null
 */
export function getCachedFloppyRender(tokenId) {
  return getCachedResult(`floppy_render_${tokenId}`);
}

/**
 * Guarda render de floppy en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} imageBuffer - Buffer de la imagen
 */
export function setCachedFloppyRender(tokenId, imageBuffer) {
  const ttl = getFloppyRenderTTL(tokenId);
  setCachedResult(`floppy_render_${tokenId}`, imageBuffer, ttl);
}

/**
 * Invalida caché de floppy render por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateFloppyRender(tokenId) {
  const key = `floppy_render_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated floppy render for token ${tokenId}`);
    return true;
  }
  return false;
}

/**
 * Invalida caché de floppy render por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateFloppyRenderRange(startId, endId) {
  let invalidated = 0;
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateFloppyRender(tokenId)) {
      invalidated++;
    }
  }
  console.log(`[cache] Invalidated ${invalidated} floppy render entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Invalida todo el caché de floppy render
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAllFloppyRender() {
  let invalidated = 0;
  const keysToDelete = [];
  
  for (const key of memoryCache.keys()) {
    if (key.startsWith('floppy_render_')) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => {
    memoryCache.delete(key);
    invalidated++;
  });
  
  console.log(`[cache] Invalidated all floppy render (${invalidated} entries)`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de floppy render
 * @returns {object} - Estadísticas del caché
 */
export function getFloppyRenderCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const floppyKeys = allKeys.filter(key => key.startsWith('floppy_render_'));
  
  const stats = {
    total: floppyKeys.length,
    traits: 0,
    floppys: 0,
    serums: 0,
    others: 0,
    keys: floppyKeys
  };
  
  floppyKeys.forEach(key => {
    const tokenId = parseInt(key.replace('floppy_render_', ''));
    
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

/**
 * Invalida tanto metadata como render de floppy por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {object} - Resultado de invalidación
 */
export function invalidateFloppyAll(tokenId) {
  const metadataInvalidated = invalidateFloppyMetadata(tokenId);
  const renderInvalidated = invalidateFloppyRender(tokenId);
  
  return {
    metadata: metadataInvalidated,
    render: renderInvalidated,
    total: (metadataInvalidated ? 1 : 0) + (renderInvalidated ? 1 : 0)
  };
}

/**
 * Invalida tanto metadata como render de floppy por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {object} - Resultado de invalidación
 */
export function invalidateFloppyAllRange(startId, endId) {
  const metadataInvalidated = invalidateFloppyMetadataRange(startId, endId);
  const renderInvalidated = invalidateFloppyRenderRange(startId, endId);
  
  return {
    metadata: metadataInvalidated,
    render: renderInvalidated,
    total: metadataInvalidated + renderInvalidated
  };
}

/**
 * Invalida todo el caché de floppy (metadata + render)
 * @returns {object} - Resultado de invalidación
 */
export function invalidateAllFloppy() {
  const metadataInvalidated = invalidateAllFloppyMetadata();
  const renderInvalidated = invalidateAllFloppyRender();
  
  return {
    metadata: metadataInvalidated,
    render: renderInvalidated,
    total: metadataInvalidated + renderInvalidated
  };
}

// ===== FUNCIONES PARA ADRIANZERO RENDER =====

/**
 * Obtiene el TTL específico para AdrianZero render según el tipo de token
 * @param {number} tokenId - Token ID
 * @returns {number} - TTL en millisegundos
 */
export function getAdrianZeroRenderTTL(tokenId) {
  const tokenIdNum = parseInt(tokenId);
  
  if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
    return 86400000; // 24h - Tokens normales
  } else if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
    return 172800000; // 48h - T-shirts personalizados
  } else if (tokenIdNum === 262144) {
    return 172800000; // 48h - Serum
  } else {
    return 3600000; // 1h - Fallback
  }
}

/**
 * Obtiene render de AdrianZero desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {Buffer|null} - Imagen cacheada o null
 */
export function getCachedAdrianZeroRender(tokenId) {
  return getCachedResult(`adrianzero_render_${tokenId}`);
}

/**
 * Guarda render de AdrianZero en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} imageBuffer - Buffer de la imagen
 */
export function setCachedAdrianZeroRender(tokenId, imageBuffer) {
  const ttl = getAdrianZeroRenderTTL(tokenId);
  setCachedResult(`adrianzero_render_${tokenId}`, imageBuffer, ttl);
}

/**
 * Invalida caché de AdrianZero render por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateAdrianZeroRender(tokenId) {
  const key = `adrianzero_render_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated AdrianZero render for token ${tokenId}`);
    return true;
  }
  return false;
}

/**
 * Invalida caché de AdrianZero render por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAdrianZeroRenderRange(startId, endId) {
  let invalidated = 0;
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateAdrianZeroRender(tokenId)) {
      invalidated++;
    }
  }
  console.log(`[cache] Invalidated ${invalidated} AdrianZero render entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de AdrianZero render
 * @returns {object} - Estadísticas del caché
 */
export function getAdrianZeroRenderCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const adrianZeroKeys = allKeys.filter(key => key.startsWith('adrianzero_render_'));
  
  const stats = {
    total: adrianZeroKeys.length,
    normal: 0,        // 1-9999
    tshirts: 0,       // 30000-35000
    serum: 0,         // 262144
    others: 0,
    keys: adrianZeroKeys
  };
  
  adrianZeroKeys.forEach(key => {
    const tokenId = parseInt(key.replace('adrianzero_render_', ''));
    
    if (tokenId >= 1 && tokenId <= 9999) {
      stats.normal++;
    } else if (tokenId >= 30000 && tokenId <= 35000) {
      stats.tshirts++;
    } else if (tokenId === 262144) {
      stats.serum++;
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

// ===== FUNCIONES ESPECÍFICAS PARA FLOPPY SVG =====

/**
 * Obtiene el TTL específico para floppy SVG (mismo que PNG)
 * @param {number} tokenId - Token ID
 * @returns {number} - TTL en millisegundos
 */
export function getFloppySvgTTL(tokenId) {
  // Usar el mismo TTL que PNG
  return getFloppyRenderTTL(tokenId);
}

/**
 * Obtiene SVG de floppy desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {string|null} - SVG cacheado o null
 */
export function getCachedFloppySvg(tokenId) {
  return getCachedResult(`floppy_svg_${tokenId}`);
}

/**
 * Guarda SVG de floppy en caché
 * @param {string|number} tokenId - Token ID
 * @param {string} svgString - String SVG
 */
export function setCachedFloppySvg(tokenId, svgString) {
  const ttl = getFloppySvgTTL(tokenId);
  setCachedResult(`floppy_svg_${tokenId}`, svgString, ttl);
}

/**
 * Invalida caché de floppy SVG por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateFloppySvg(tokenId) {
  const key = `floppy_svg_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated floppy SVG for token ${tokenId}`);
    return true;
  }
  return false;
}

/**
 * Invalida caché de floppy SVG por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateFloppySvgRange(startId, endId) {
  let invalidated = 0;
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateFloppySvg(tokenId)) {
      invalidated++;
    }
  }
  console.log(`[cache] Invalidated ${invalidated} floppy SVG entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Invalida todo el caché de floppy SVG
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAllFloppySvg() {
  const allKeys = Array.from(memoryCache.keys());
  const floppySvgKeys = allKeys.filter(key => key.startsWith('floppy_svg_'));
  
  let invalidated = 0;
  floppySvgKeys.forEach(key => {
    memoryCache.delete(key);
    invalidated++;
  });
  
  console.log(`[cache] Invalidated all ${invalidated} floppy SVG entries`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de floppy SVG
 * @returns {object} - Estadísticas del caché
 */
export function getFloppySvgCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const floppySvgKeys = allKeys.filter(key => key.startsWith('floppy_svg_'));
  
  const stats = {
    total: floppySvgKeys.length,
    traits: 0,
    floppys: 0,
    serums: 0,
    tshirts: 0,
    others: 0,
    keys: floppySvgKeys
  };
  
  floppySvgKeys.forEach(key => {
    const tokenId = parseInt(key.replace('floppy_svg_', ''));
    
    if (tokenId >= 1 && tokenId <= 9999) {
      stats.traits++;
    } else if (tokenId >= 10000 && tokenId <= 15500) {
      stats.floppys++;
    } else if (tokenId === 262144) {
      stats.serums++;
    } else if (tokenId >= 30000 && tokenId <= 35000) {
      stats.tshirts++;
    } else {
      stats.others++;
    }
  });
  
  return stats;
}
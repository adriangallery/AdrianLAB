// Cache system to optimize renders
const memoryCache = new Map();

// ===== FUNCIONES ESPECÍFICAS PARA NANOBANANA =====

/**
 * TTL para caché de Nanobanana (24 horas - transformaciones son costosas)
 */
const NANOBANANA_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene render de Nanobanana desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {Buffer|null} - Imagen cacheada o null
 */
export function getCachedNanobananaRender(tokenId) {
  return getCachedResult(`nanobanana_render_${tokenId}`);
}

/**
 * Guarda render de Nanobanana en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} imageBuffer - Buffer de la imagen transformada
 */
export function setCachedNanobananaRender(tokenId, imageBuffer) {
  setCachedResult(`nanobanana_render_${tokenId}`, imageBuffer, NANOBANANA_CACHE_TTL);
}

/**
 * Invalida caché de Nanobanana render por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateNanobananaRender(tokenId) {
  const key = `nanobanana_render_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated nanobanana render for token ${tokenId}`);
    return true;
  }
  return false;
}

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
 * Limpia completamente el caché de floppy render
 * @returns {number} - Número de entradas limpiadas
 */
export function clearFloppyRenderCache() {
  const allKeys = Array.from(memoryCache.keys());
  const floppyKeys = allKeys.filter(key => key.startsWith('floppy_render_'));
  
  let cleared = 0;
  floppyKeys.forEach(key => {
    memoryCache.delete(key);
    cleared++;
  });
  
  console.log(`[cache] Cleared all floppy render cache (${cleared} entries)`);
  return cleared;
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
  
  if (tokenIdNum >= 500 && tokenIdNum <= 1099) {
    return 172800000; // 48h - SamuraiZERO (imágenes estáticas)
  } else if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
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
 * Genera clave de caché para render de AdrianZero incluyendo efectos
 * @param {string|number} tokenId - Token ID
 * @param {boolean} isShadow - Si shadow está activo
 * @param {boolean} isGlow - Si glow está activo
 * @param {boolean} isBn - Si BN está activo
 * @returns {string} - Clave de caché
 */
function getAdrianZeroRenderCacheKey(tokenId, isShadow = false, isGlow = false, isBn = false, isUv = false, isBlackout = false, isBanana = false) {
  const effects = [];
  if (isShadow) effects.push('shadow');
  if (isGlow) effects.push('glow');
  if (isBn) effects.push('bn');
  if (isUv) effects.push('uv');
  if (isBlackout) effects.push('blackout');
  if (isBanana) effects.push('banana');
  const effectsSuffix = effects.length > 0 ? `_${effects.join('_')}` : '';
  return `adrianzero_render_${tokenId}${effectsSuffix}`;
}

/**
 * Genera una clave de caché única basada en tokenId y finalTraits
 * @param {string|number} tokenId - Token ID
 * @param {Object} finalTraits - Objeto con los traits finales { CATEGORY: traitId, ... }
 * @param {boolean} isCloseup - Si es closeup
 * @returns {string} - Clave de caché
 */
function getAdrianZeroCustomRenderCacheKey(tokenId, finalTraits, isCloseup = false) {
  // Crear un string estable y ordenado de los traits para la clave
  const traitsEntries = Object.entries(finalTraits || {})
    .sort(([a], [b]) => a.localeCompare(b)) // Ordenar por categoría
    .map(([category, traitId]) => `${category}:${traitId}`)
    .join('|');
  
  // Crear hash simple para evitar claves muy largas
  // Usar una función hash simple basada en el string
  let hash = 0;
  const traitsStr = traitsEntries || '';
  for (let i = 0; i < traitsStr.length; i++) {
    const char = traitsStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32bit integer
  }
  const traitsHash = Math.abs(hash).toString(36); // Convertir a base36 para acortar
  
  const closeupSuffix = isCloseup ? '_closeup' : '';
  return `adrianzero_custom_${tokenId}_${traitsHash}${closeupSuffix}`;
}

/**
 * Obtiene render de AdrianZero desde caché
 * @param {string|number} tokenId - Token ID
 * @param {boolean} isShadow - Si shadow está activo
 * @param {boolean} isGlow - Si glow está activo
 * @param {boolean} isBn - Si BN está activo
 * @param {boolean} isUv - Si UV está activo
 * @param {boolean} isBlackout - Si blackout está activo
 * @returns {Buffer|null} - Imagen cacheada o null
 */
export function getCachedAdrianZeroRender(tokenId, isShadow = false, isGlow = false, isBn = false, isUv = false, isBlackout = false, isBanana = false) {
  const key = getAdrianZeroRenderCacheKey(tokenId, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
  return getCachedResult(key);
}

/**
 * Guarda render de AdrianZero en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {boolean} isShadow - Si shadow está activo
 * @param {boolean} isGlow - Si glow está activo
 * @param {boolean} isBn - Si BN está activo
 * @param {boolean} isUv - Si UV está activo
 * @param {boolean} isBlackout - Si blackout está activo
 */
export function setCachedAdrianZeroRender(tokenId, imageBuffer, isShadow = false, isGlow = false, isBn = false, isUv = false, isBlackout = false, isBanana = false) {
  const ttl = getAdrianZeroRenderTTL(tokenId);
  const key = getAdrianZeroRenderCacheKey(tokenId, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
  setCachedResult(key, imageBuffer, ttl);
  
  const effectsStr = [isShadow && 'shadow', isGlow && 'glow', isBn && 'bn', isUv && 'uv', isBlackout && 'blackout', isBanana && 'banana'].filter(Boolean).join('+');
  console.log(`[cache] Cached AdrianZero render: token ${tokenId}${effectsStr ? ` (${effectsStr})` : ''} for ${Math.floor(ttl/3600000)}h`);
}

/**
 * Invalida caché de AdrianZero render por token específico (todas las variantes)
 * @param {string|number} tokenId - Token ID
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAdrianZeroRender(tokenId) {
  let invalidated = 0;
  const baseKey = `adrianzero_render_${tokenId}`;
  
  // Invalidar todas las posibles combinaciones de efectos
  const effects = ['', '_shadow', '_glow', '_bn', '_shadow_glow', '_shadow_bn', '_glow_bn', '_shadow_glow_bn'];
  for (const effect of effects) {
    const key = `${baseKey}${effect}`;
    if (memoryCache.has(key)) {
      memoryCache.delete(key);
      invalidated++;
    }
  }
  
  if (invalidated > 0) {
    console.log(`[cache] Invalidated ${invalidated} AdrianZero render variant(s) for token ${tokenId}`);
  }
  return invalidated;
}

/**
 * Obtiene render custom de AdrianZero desde caché (con traits personalizados)
 * @param {string|number} tokenId - Token ID
 * @param {Object} finalTraits - Objeto con los traits finales { CATEGORY: traitId, ... }
 * @param {boolean} isCloseup - Si es closeup
 * @returns {Buffer|null} - Imagen cacheada o null
 */
export function getCachedAdrianZeroCustomRender(tokenId, finalTraits, isCloseup = false) {
  const key = getAdrianZeroCustomRenderCacheKey(tokenId, finalTraits, isCloseup);
  return getCachedResult(key);
}

/**
 * Guarda render custom de AdrianZero en caché (con traits personalizados)
 * @param {string|number} tokenId - Token ID
 * @param {Object} finalTraits - Objeto con los traits finales { CATEGORY: traitId, ... }
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {boolean} isCloseup - Si es closeup
 */
export function setCachedAdrianZeroCustomRender(tokenId, finalTraits, imageBuffer, isCloseup = false) {
  const ttl = getAdrianZeroRenderTTL(tokenId);
  const key = getAdrianZeroCustomRenderCacheKey(tokenId, finalTraits, isCloseup);
  setCachedResult(key, imageBuffer, ttl);
  
  // Crear string descriptivo de traits para el log
  const traitsStr = Object.entries(finalTraits || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, id]) => `${cat}:${id}`)
    .join(', ');
  
  const closeupStr = isCloseup ? ' (closeup)' : '';
  console.log(`[cache] Cached AdrianZero custom render: token ${tokenId}${closeupStr} with traits [${traitsStr}] for ${Math.floor(ttl/3600000)}h`);
}

// ===== FUNCIONES ESPECÍFICAS PARA CLOSEUP =====

/**
 * Genera clave de caché para render closeup de AdrianZero incluyendo efectos
 * @param {string|number} tokenId - Token ID
 * @param {boolean} isShadow - Si shadow está activo
 * @param {boolean} isGlow - Si glow está activo
 * @param {boolean} isBn - Si BN está activo
 * @returns {string} - Clave de caché
 */
function getAdrianZeroCloseupCacheKey(tokenId, isShadow = false, isGlow = false, isBn = false, isUv = false, isBlackout = false, isBanana = false) {
  const effects = [];
  if (isShadow) effects.push('shadow');
  if (isGlow) effects.push('glow');
  if (isBn) effects.push('bn');
  if (isUv) effects.push('uv');
  if (isBlackout) effects.push('blackout');
  if (isBanana) effects.push('banana');
  const effectsSuffix = effects.length > 0 ? `_${effects.join('_')}` : '';
  return `adrianzero_closeup_${tokenId}${effectsSuffix}`;
}

/**
 * Obtiene render closeup de AdrianZero desde caché
 * @param {string|number} tokenId - Token ID
 * @param {boolean} isShadow - Si shadow está activo
 * @param {boolean} isGlow - Si glow está activo
 * @param {boolean} isBn - Si BN está activo
 * @param {boolean} isUv - Si UV está activo
 * @param {boolean} isBlackout - Si blackout está activo
 * @returns {Buffer|null} - Imagen closeup cacheada o null
 */
export function getCachedAdrianZeroCloseup(tokenId, isShadow = false, isGlow = false, isBn = false, isUv = false, isBlackout = false, isBanana = false) {
  const key = getAdrianZeroCloseupCacheKey(tokenId, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
  return getCachedResult(key);
}

/**
 * Guarda render closeup de AdrianZero en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} imageBuffer - Buffer de la imagen closeup
 * @param {boolean} isShadow - Si shadow está activo
 * @param {boolean} isGlow - Si glow está activo
 * @param {boolean} isBn - Si BN está activo
 * @param {boolean} isUv - Si UV está activo
 * @param {boolean} isBlackout - Si blackout está activo
 */
export function setCachedAdrianZeroCloseup(tokenId, imageBuffer, isShadow = false, isGlow = false, isBn = false, isUv = false, isBlackout = false, isBanana = false) {
  const ttl = getAdrianZeroRenderTTL(tokenId);
  const key = getAdrianZeroCloseupCacheKey(tokenId, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
  setCachedResult(key, imageBuffer, ttl);
  
  const effectsStr = [isShadow && 'shadow', isGlow && 'glow', isBn && 'bn', isUv && 'uv', isBlackout && 'blackout', isBanana && 'banana'].filter(Boolean).join('+');
  console.log(`[cache] Cached AdrianZero closeup: token ${tokenId}${effectsStr ? ` (${effectsStr})` : ''} for ${Math.floor(ttl/3600000)}h`);
}

/**
 * Invalida caché de AdrianZero closeup por token específico (todas las variantes)
 * @param {string|number} tokenId - Token ID
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAdrianZeroCloseup(tokenId) {
  let invalidated = 0;
  const baseKey = `adrianzero_closeup_${tokenId}`;
  
  // Invalidar todas las posibles combinaciones de efectos
  const effects = ['', '_shadow', '_glow', '_bn', '_shadow_glow', '_shadow_bn', '_glow_bn', '_shadow_glow_bn'];
  for (const effect of effects) {
    const key = `${baseKey}${effect}`;
    if (memoryCache.has(key)) {
      memoryCache.delete(key);
      invalidated++;
    }
  }
  
  if (invalidated > 0) {
    console.log(`[cache] Invalidated ${invalidated} AdrianZero closeup variant(s) for token ${tokenId}`);
  }
  return invalidated;
}

/**
 * Invalida caché de AdrianZero closeup por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAdrianZeroCloseupRange(startId, endId) {
  let invalidated = 0;
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateAdrianZeroCloseup(tokenId)) {
      invalidated++;
    }
  }
  console.log(`[cache] Invalidated ${invalidated} AdrianZero closeup entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de closeup
 * @returns {object} - Estadísticas del caché
 */
export function getCloseupCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const closeupKeys = allKeys.filter(key => key.startsWith('adrianzero_closeup_'));
  
  return {
    totalCloseupEntries: closeupKeys.length,
    keys: closeupKeys
  };
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

// ===== FUNCIONES ESPECÍFICAS PARA SAMURAIZERO =====

/**
 * Invalida caché de SamuraiZERO por rango de tokens
 * @param {number} startId - Token ID inicial (default: 500)
 * @param {number} endId - Token ID final (default: 1099)
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateSamuraiZERORange(startId = 500, endId = 1099) {
  let invalidated = 0;
  
  // Invalidar AdrianZERO render
  invalidated += invalidateAdrianZeroRenderRange(startId, endId);
  
  // Invalidar componentes (usando trait_ como prefijo)
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    const key = `trait_${tokenId}`;
    if (memoryCache.has(key)) {
      memoryCache.delete(key);
      invalidated++;
    }
  }
  
  console.log(`[cache] Invalidated ${invalidated} SamuraiZERO entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de SamuraiZERO
 * @returns {object} - Estadísticas del caché
 */
export function getSamuraiZEROCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const samuraiKeys = allKeys.filter(key => {
    const tokenId = parseInt(key.replace(/.*_(\d+)$/, '$1'));
    return tokenId >= 500 && tokenId <= 1099;
  });
  
  return {
    totalSamuraiEntries: samuraiKeys.length,
    renderEntries: samuraiKeys.filter(k => k.startsWith('adrianzero_render_')).length,
    componentEntries: samuraiKeys.filter(k => k.startsWith('trait_')).length,
    svgPngEntries: samuraiKeys.filter(k => k.includes('svg')).length,
    keys: samuraiKeys
  };
}

/**
 * Invalida todo el caché de SamuraiZERO
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAllSamuraiZERO() {
  return invalidateSamuraiZERORange(500, 1099);
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

// ===== FUNCIONES ESPECÍFICAS PARA ADRIANZERO SVG =====

/**
 * Obtiene el TTL específico para AdrianZERO SVG (mismo que PNG)
 * @param {number} tokenId - Token ID
 * @returns {number} - TTL en millisegundos
 */
export function getAdrianZeroSvgTTL(tokenId) {
  // Usar el mismo TTL que PNG
  return getAdrianZeroRenderTTL(tokenId);
}

/**
 * Obtiene SVG de AdrianZERO desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {string|null} - SVG cacheado o null
 */
export function getCachedAdrianZeroSvg(tokenId) {
  return getCachedResult(`adrianzero_svg_${tokenId}`);
}

/**
 * Guarda SVG de AdrianZERO en caché
 * @param {string|number} tokenId - Token ID
 * @param {string} svgString - String SVG
 */
export function setCachedAdrianZeroSvg(tokenId, svgString) {
  const ttl = getAdrianZeroSvgTTL(tokenId);
  setCachedResult(`adrianzero_svg_${tokenId}`, svgString, ttl);
}

/**
 * Invalida caché de AdrianZERO SVG por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateAdrianZeroSvg(tokenId) {
  const key = `adrianzero_svg_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated AdrianZERO SVG for token ${tokenId}`);
    return true;
  }
  return false;
}

/**
 * Invalida caché de AdrianZERO SVG por rango de tokens
 * @param {number} startId - Token ID inicial
 * @param {number} endId - Token ID final
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAdrianZeroSvgRange(startId, endId) {
  let invalidated = 0;
  for (let tokenId = startId; tokenId <= endId; tokenId++) {
    if (invalidateAdrianZeroSvg(tokenId)) {
      invalidated++;
    }
  }
  console.log(`[cache] Invalidated ${invalidated} AdrianZERO SVG entries for range ${startId}-${endId}`);
  return invalidated;
}

/**
 * Invalida todo el caché de AdrianZERO SVG
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAllAdrianZeroSvg() {
  const allKeys = Array.from(memoryCache.keys());
  const adrianZeroSvgKeys = allKeys.filter(key => key.startsWith('adrianzero_svg_'));
  
  let invalidated = 0;
  adrianZeroSvgKeys.forEach(key => {
    memoryCache.delete(key);
    invalidated++;
  });
  
  console.log(`[cache] Invalidated all ${invalidated} AdrianZERO SVG entries`);
  return invalidated;
}

/**
 * Obtiene estadísticas específicas del caché de AdrianZERO SVG
 * @returns {object} - Estadísticas del caché
 */
export function getAdrianZeroSvgCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const adrianZeroSvgKeys = allKeys.filter(key => key.startsWith('adrianzero_svg_'));
  
  const stats = {
    total: adrianZeroSvgKeys.length,
    normal: 0,        // 1-9999
    tshirts: 0,       // 30000-35000
    serum: 0,         // 262144
    others: 0,
    keys: adrianZeroSvgKeys
  };
  
  adrianZeroSvgKeys.forEach(key => {
    const tokenId = parseInt(key.replace('adrianzero_svg_', ''));
    
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

// ===== FUNCIONES PARA CACHÉ DE CONTRATOS =====

/**
 * Obtiene estadísticas del caché de contratos
 * @returns {Object} - Estadísticas del caché de contratos
 */
export async function getContractCacheStats() {
  try {
    const { getContractCacheStats } = await import('./contract-cache.js');
    return getContractCacheStats();
  } catch (error) {
    console.error('[cache] Error importing contract-cache:', error);
    return {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
      memoryUsage: '0KB',
      ttl: '24h'
    };
  }
}

/**
 * Limpia el caché completo de contratos
 * @returns {number} - Número de entradas eliminadas
 */
export async function clearContractCache() {
  try {
    const { clearContractCache } = await import('./contract-cache.js');
    return clearContractCache();
  } catch (error) {
    console.error('[cache] Error importing contract-cache:', error);
    return 0;
  }
}

/**
 * Limpia el caché de contratos para un token específico
 * @param {string|number} tokenId - ID del token
 * @returns {number} - Número de entradas eliminadas
 */
export async function clearContractCacheForToken(tokenId) {
  try {
    const { clearContractCacheForToken } = await import('./contract-cache.js');
    return clearContractCacheForToken(tokenId);
  } catch (error) {
    console.error('[cache] Error importing contract-cache:', error);
    return 0;
  }
}

/**
 * Limpia entradas expiradas del caché de contratos
 * @returns {number} - Número de entradas expiradas eliminadas
 */
export async function cleanupExpiredContractEntries() {
  try {
    const { cleanupExpiredEntries } = await import('./contract-cache.js');
    return cleanupExpiredEntries();
  } catch (error) {
    console.error('[cache] Error importing contract-cache:', error);
    return 0;
  }
}

// ===== FUNCIONES PARA CACHÉ DE JSON =====

/**
 * Obtiene estadísticas del caché de JSON
 * @returns {Object} - Estadísticas del caché de JSON
 */
export async function getJsonCacheStats() {
  try {
    const { getJsonCacheStats } = await import('./json-cache.js');
    return getJsonCacheStats();
  } catch (error) {
    console.error('[cache] Error importing json-cache:', error);
    return {
      totalFiles: 0,
      validFiles: 0,
      expiredFiles: 0,
      memoryUsage: '0KB',
      ttl: '7 días'
    };
  }
}

/**
 * Limpia el caché completo de JSON
 * @returns {number} - Número de archivos eliminados
 */
export async function clearJsonCache() {
  try {
    const { clearJsonCache } = await import('./json-cache.js');
    return clearJsonCache();
  } catch (error) {
    console.error('[cache] Error importing json-cache:', error);
    return 0;
  }
}

/**
 * Limpia entradas expiradas del caché de JSON
 * @returns {number} - Número de archivos expirados eliminados
 */
export async function cleanupExpiredJsonEntries() {
  try {
    const { cleanupExpiredJsonEntries } = await import('./json-cache.js');
    return cleanupExpiredJsonEntries();
  } catch (error) {
    console.error('[cache] Error importing json-cache:', error);
    return 0;
  }
}

// ===== FUNCIONES PARA CACHÉ SVG→PNG =====

/**
 * Obtiene estadísticas del caché de SVG→PNG
 * @returns {Object} - Estadísticas del caché de SVG→PNG
 */
export async function getSvgPngCacheStats() {
  try {
    const { getSvgPngCacheStats } = await import('./svg-png-cache.js');
    return getSvgPngCacheStats();
  } catch (error) {
    console.error('[cache] Error importing svg-png-cache:', error);
    return {
      totalConversions: 0,
      validConversions: 0,
      expiredConversions: 0,
      memoryUsage: '0KB',
      ttl: '24h'
    };
  }
}

/**
 * Limpia el caché completo de SVG→PNG
 * @returns {number} - Número de conversiones eliminadas
 */
export async function clearSvgPngCache() {
  try {
    const { clearSvgPngCache } = await import('./svg-png-cache.js');
    return clearSvgPngCache();
  } catch (error) {
    console.error('[cache] Error importing svg-png-cache:', error);
    return 0;
  }
}

/**
 * Limpia entradas expiradas del caché de SVG→PNG
 * @returns {number} - Número de conversiones expiradas eliminadas
 */
export async function cleanupExpiredSvgPngEntries() {
  try {
    const { cleanupExpiredSvgPngEntries } = await import('./svg-png-cache.js');
    return cleanupExpiredSvgPngEntries();
  } catch (error) {
    console.error('[cache] Error importing svg-png-cache:', error);
    return 0;
  }
}

// ===== FUNCIONES PARA CACHÉ DE COMPONENTES =====

/**
 * Obtiene estadísticas del caché de componentes
 * @returns {Object} - Estadísticas del caché de componentes
 */
export async function getComponentCacheStats() {
  try {
    const { getComponentCacheStats } = await import('./component-cache.js');
    return getComponentCacheStats();
  } catch (error) {
    console.error('[cache] Error importing component-cache:', error);
    return {
      totalComponents: 0,
      validComponents: 0,
      expiredComponents: 0,
      backgroundComponents: 0,
      skinComponents: 0,
      traitComponents: 0,
      memoryUsage: '0KB',
      ttl: '24h'
    };
  }
}

/**
 * Limpia el caché completo de componentes
 * @returns {number} - Número de componentes eliminados
 */
export async function clearComponentCache() {
  try {
    const { clearComponentCache } = await import('./component-cache.js');
    return clearComponentCache();
  } catch (error) {
    console.error('[cache] Error importing component-cache:', error);
    return 0;
  }
}

/**
 * Limpia entradas expiradas del caché de componentes
 * @returns {number} - Número de componentes expirados eliminados
 */
export async function cleanupExpiredComponentEntries() {
  try {
    const { cleanupExpiredComponentEntries } = await import('./component-cache.js');
    return cleanupExpiredComponentEntries();
  } catch (error) {
    console.error('[cache] Error importing component-cache:', error);
    return 0;
  }
}

// ===== FUNCIONES ESPECÍFICAS PARA GIFs ANIMADOS =====

/**
 * Obtiene GIF de AdrianZero desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {Buffer|null} - GIF cacheado o null
 */
export function getCachedAdrianZeroGif(tokenId) {
  return getCachedResult(`adrianzero_gif_${tokenId}`);
}

/**
 * Guarda GIF de AdrianZero en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} gifBuffer - Buffer del GIF
 */
export function setCachedAdrianZeroGif(tokenId, gifBuffer) {
  const ttl = getAdrianZeroRenderTTL(tokenId); // Mismo TTL que PNGs
  setCachedResult(`adrianzero_gif_${tokenId}`, gifBuffer, ttl);
  console.log(`[cache] Cached AdrianZero GIF: token ${tokenId} for ${Math.floor(ttl/3600000)}h`);
}

/**
 * Invalida caché de AdrianZero GIF por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateAdrianZeroGif(tokenId) {
  const key = `adrianzero_gif_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated AdrianZero GIF for token ${tokenId}`);
    return true;
  }
  return false;
}

/**
 * Obtiene GIF de Floppy desde caché
 * @param {string|number} tokenId - Token ID
 * @returns {Buffer|null} - GIF cacheado o null
 */
export function getCachedFloppyGif(tokenId) {
  return getCachedResult(`floppy_gif_${tokenId}`);
}

/**
 * Guarda GIF de Floppy en caché
 * @param {string|number} tokenId - Token ID
 * @param {Buffer} gifBuffer - Buffer del GIF
 */
export function setCachedFloppyGif(tokenId, gifBuffer) {
  const ttl = getFloppyRenderTTL(tokenId); // Mismo TTL que PNGs
  setCachedResult(`floppy_gif_${tokenId}`, gifBuffer, ttl);
  console.log(`[cache] Cached Floppy GIF: token ${tokenId} for ${Math.floor(ttl/3600000)}h`);
}

/**
 * Invalida caché de Floppy GIF por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {boolean} - true si se invalidó, false si no existía
 */
export function invalidateFloppyGif(tokenId) {
  const key = `floppy_gif_${tokenId}`;
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
    console.log(`[cache] Invalidated Floppy GIF for token ${tokenId}`);
    return true;
  }
  return false;
}
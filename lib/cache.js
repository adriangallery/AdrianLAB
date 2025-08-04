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

// ===== FUNCIONES PARA ADRIANZERO CUSTOM RENDER =====

/**
 * Obtiene el TTL específico para AdrianZero custom render
 * @param {number} tokenId - Token ID
 * @returns {number} - TTL en millisegundos (7 días para custom renders)
 */
export function getAdrianZeroCustomRenderTTL(tokenId) {
  // TTL largo para custom renders - las combinaciones específicas no cambian
  return 604800000; // 7 días (7 * 24 * 60 * 60 * 1000)
}

/**
 * Obtiene render custom de AdrianZero desde caché
 * @param {string|number} tokenId - Token ID
 * @param {Array} traitParams - Array de trait IDs
 * @returns {Buffer|null} - Imagen cacheada o null
 */
export function getCachedAdrianZeroCustomRender(tokenId, traitParams) {
  // Crear key única basada en tokenId + traits específicos
  const sortedTraits = traitParams.sort((a, b) => parseInt(a) - parseInt(b)); // Ordenar para consistencia
  const traitsKey = sortedTraits.join('-');
  const cacheKey = `adrianzero_custom_${tokenId}_traits_${traitsKey}`;
  return getCachedResult(cacheKey);
}

/**
 * Guarda render custom de AdrianZero en caché
 * @param {string|number} tokenId - Token ID
 * @param {Array} traitParams - Array de trait IDs
 * @param {Buffer} imageBuffer - Buffer de la imagen
 */
export function setCachedAdrianZeroCustomRender(tokenId, traitParams, imageBuffer) {
  const ttl = getAdrianZeroCustomRenderTTL(tokenId);
  const sortedTraits = traitParams.sort((a, b) => parseInt(a) - parseInt(b));
  const traitsKey = sortedTraits.join('-');
  const cacheKey = `adrianzero_custom_${tokenId}_traits_${traitsKey}`;
  setCachedResult(cacheKey, imageBuffer, ttl);
  
  console.log(`[cache] Cached AdrianZero custom render: ${cacheKey} for 7 days`);
}

/**
 * Invalida caché de AdrianZero custom render por token específico
 * @param {string|number} tokenId - Token ID
 * @returns {number} - Número de entradas invalidadas
 */
export function invalidateAdrianZeroCustomRender(tokenId) {
  const allKeys = Array.from(memoryCache.keys());
  const customKeys = allKeys.filter(key => key.startsWith(`adrianzero_custom_${tokenId}_traits_`));
  
  let invalidated = 0;
  customKeys.forEach(key => {
    memoryCache.delete(key);
    invalidated++;
  });
  
  console.log(`[cache] Invalidated ${invalidated} AdrianZero custom render entries for token ${tokenId}`);
  return invalidated;
}



/**
 * Obtiene estadísticas específicas del caché de AdrianZero custom render
 * @returns {object} - Estadísticas del caché
 */
export function getAdrianZeroCustomRenderCacheStats() {
  const allKeys = Array.from(memoryCache.keys());
  const customKeys = allKeys.filter(key => key.startsWith('adrianzero_custom_') && key.includes('_traits_'));
  
  const stats = {
    total: customKeys.length,
    normal: 0,        // 1-9999
    tshirts: 0,       // 30000-35000
    serum: 0,         // 262144
    others: 0,
    keys: customKeys.slice(0, 10), // Solo mostrar primeras 10 para UI
    totalKeys: customKeys.length
  };
  
  customKeys.forEach(key => {
    const tokenId = parseInt(key.split('_')[2]); // adrianzero_custom_208_traits_133-245-2
    
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

/**
 * Invalida TODOS los cachés de un token específico
 * @param {string|number} tokenId - Token ID
 * @returns {object} - Resumen de lo que se invalidó
 */
export function invalidateAllCachesForToken(tokenId) {
  const results = {
    adrianZeroRender: invalidateAdrianZeroRender(tokenId),
    adrianZeroCustom: invalidateAdrianZeroCustomRender(tokenId),
    floppyRender: invalidateFloppyRender(tokenId),
    floppyMetadata: invalidateFloppyMetadata(tokenId)
  };
  
  const totalInvalidated = Object.values(results).reduce((sum, val) => sum + (typeof val === 'number' ? val : (val ? 1 : 0)), 0);
  
  console.log(`[cache] Invalidated all caches for token ${tokenId}:`, results);
  return {
    ...results,
    totalInvalidated
  };
}

// ===== SISTEMA DE PRECARGA SVG → PNG =====

/**
 * Configuración de tokens prioritarios para precarga
 */
export const PREGEN_CONFIG = {
  // TIER 1: CRÍTICOS (Precarga inmediata)
  critical: {
    featured: [1, 2, 3, 208, 262144], // Tokens icónicos
    tshirts_sample: Array.from({length: 50}, (_, i) => 30000 + i), // Primeros 50 T-shirts
    serum: [262144], // Serum especial
    popular_ranges: [
      { start: 1, end: 100 },      // Primeros 100 tokens
      { start: 1000, end: 1050 },  // Rango milestone
      { start: 5000, end: 5050 }   // Otro rango popular
    ]
  },

  // TIER 2: IMPORTANTES (Precarga programada)
  important: {
    tshirts_extended: Array.from({length: 200}, (_, i) => 30000 + i), // Más T-shirts
    milestone_tokens: [500, 1000, 1500, 2000, 2500, 3000], // Tokens milestone
  },

  // TIER 3: OPORTUNISTAS (Precarga bajo demanda)
  opportunistic: {
    recently_viewed: [], // Últimos 100 tokens visitados
    trending: [],        // Tokens con picos de tráfico
  }
};

/**
 * Obtiene la ruta de archivo pregenerado
 * @param {string|number} tokenId - Token ID
 * @param {string} type - Tipo de render ('normal', 'custom', 'lambo')
 * @param {Array} traits - Array de traits (solo para custom)
 * @returns {string} - Ruta del archivo
 */
export function getPregenPath(tokenId, type = 'normal', traits = []) {
  const basePath = 'public/pregenerated/adrianzero';
  
  switch (type) {
    case 'normal':
      return `${basePath}/skins/${tokenId}.png`;
    case 'custom':
      if (traits.length === 0) return null;
      const traitsKey = traits.sort((a, b) => parseInt(a) - parseInt(b)).join('-');
      return `${basePath}/custom/popular/${tokenId}_${traitsKey}.png`;
    case 'lambo':
      return `${basePath}/lambo/${tokenId}.png`;
    default:
      return null;
  }
}

/**
 * Verifica si existe un archivo pregenerado
 * @param {string|number} tokenId - Token ID
 * @param {string} type - Tipo de render
 * @param {Array} traits - Array de traits
 * @returns {boolean} - True si existe
 */
export function hasPregeneratedFile(tokenId, type = 'normal', traits = []) {
  const fs = require('fs');
  const path = getPregenPath(tokenId, type, traits);
  return path ? fs.existsSync(path) : false;
}

/**
 * Lee un archivo pregenerado
 * @param {string|number} tokenId - Token ID
 * @param {string} type - Tipo de render
 * @param {Array} traits - Array de traits
 * @returns {Buffer|null} - Buffer de la imagen o null
 */
export function readPregeneratedFile(tokenId, type = 'normal', traits = []) {
  const fs = require('fs');
  const path = getPregenPath(tokenId, type, traits);
  
  if (!path || !fs.existsSync(path)) {
    return null;
  }
  
  try {
    return fs.readFileSync(path);
  } catch (error) {
    console.error(`[pregen] Error reading pregenerated file: ${path}`, error);
    return null;
  }
}

/**
 * Guarda un archivo pregenerado
 * @param {string|number} tokenId - Token ID
 * @param {string} type - Tipo de render
 * @param {Array} traits - Array de traits
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @returns {boolean} - True si se guardó exitosamente
 */
export function savePregeneratedFile(tokenId, type = 'normal', traits = [], imageBuffer) {
  const fs = require('fs');
  const path = require('path');
  const filePath = getPregenPath(tokenId, type, traits);
  
  if (!filePath) {
    console.error(`[pregen] Invalid path for token ${tokenId}, type ${type}`);
    return false;
  }
  
  try {
    // Crear directorio si no existe
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Guardar archivo
    fs.writeFileSync(filePath, imageBuffer);
    console.log(`[pregen] ✅ Saved pregenerated file: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[pregen] Error saving pregenerated file: ${filePath}`, error);
    return false;
  }
}

/**
 * Trigger asíncrono para precarga (no bloquea la respuesta)
 * @param {string|number} tokenId - Token ID
 * @param {Array} traits - Array de traits
 * @param {Buffer} imageBuffer - Buffer de la imagen
 * @param {string} priority - Prioridad ('HIGH', 'MEDIUM', 'LOW')
 */
export function triggerAsyncPregeneration(tokenId, traits = [], imageBuffer = null, priority = 'MEDIUM') {
  // Ejecutar de forma asíncrona para no bloquear la respuesta
  setImmediate(() => {
    try {
      if (imageBuffer) {
        // Si ya tenemos el buffer, guardarlo directamente
        savePregeneratedFile(tokenId, 'custom', traits, imageBuffer);
      } else {
        // Si no tenemos el buffer, programar generación
        schedulePregeneration(tokenId, traits, null, priority);
      }
    } catch (error) {
      console.error(`[pregen] Error in async pregeneration for token ${tokenId}:`, error);
    }
  });
}

/**
 * Programa una precarga (placeholder para futura implementación)
 * @param {string|number} tokenId - Token ID
 * @param {Array} traits - Array de traits
 * @param {Buffer} imageBuffer - Buffer de la imagen (opcional)
 * @param {string} priority - Prioridad
 */
export function schedulePregeneration(tokenId, traits = [], imageBuffer = null, priority = 'MEDIUM') {
  console.log(`[pregen] 📅 Scheduled pregeneration: Token ${tokenId}, traits [${traits.join(', ')}], priority ${priority}`);
  
  // Si ya tenemos el buffer, guardarlo directamente
  if (imageBuffer) {
    savePregeneratedFile(tokenId, 'custom', traits, imageBuffer);
    return;
  }
  
  // Para skins base (sin traits), generar el render normal
  if (traits.length === 0) {
    generateAndSaveSkinBase(tokenId, priority);
  }
}

/**
 * Genera y guarda un skin base (render normal)
 * @param {string|number} tokenId - Token ID
 * @param {string} priority - Prioridad
 */
async function generateAndSaveSkinBase(tokenId, priority = 'MEDIUM') {
  try {
    console.log(`[pregen] 🎨 Generating skin base for token ${tokenId}`);
    
    // Importar dinámicamente para evitar dependencias circulares
    const { createCanvas, loadImage } = await import('canvas');
    const { getContracts } = await import('./contracts.js');
    const { Resvg } = await import('@resvg/resvg-js');
    
    // Crear canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Cargar metadata del token
    const contracts = getContracts();
    const tokenData = await contracts.adrianZero.getTokenData(tokenId);
    
    // Renderizar skin base (lógica simplificada)
    // Aquí iría la lógica completa de renderizado
    // Por ahora solo creamos un placeholder
    
    // Crear imagen placeholder
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Token ${tokenId}`, 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText('Pregenerated Skin', 500, 500);
    
    const buffer = canvas.toBuffer('image/png');
    
    // Guardar archivo
    const saved = savePregeneratedFile(tokenId, 'normal', [], buffer);
    
    if (saved) {
      console.log(`[pregen] ✅ Skin base generated and saved for token ${tokenId}`);
    } else {
      console.error(`[pregen] ❌ Failed to save skin base for token ${tokenId}`);
    }
    
  } catch (error) {
    console.error(`[pregen] Error generating skin base for token ${tokenId}:`, error);
  }
}

/**
 * Obtiene estadísticas de archivos pregenerados
 * @returns {object} - Estadísticas
 */
export function getPregenerationStats() {
  const fs = require('fs');
  const path = require('path');
  
  const basePath = 'public/pregenerated/adrianzero';
  const stats = {
    total: 0,
    skins: 0,
    custom: 0,
    tshirts: 0,
    lambo: 0,
    totalSize: 0
  };
  
  try {
    // Contar archivos en cada directorio
    const countFiles = (dirPath) => {
      if (!fs.existsSync(dirPath)) return 0;
      const files = fs.readdirSync(dirPath);
      return files.filter(file => file.endsWith('.png')).length;
    };
    
    const getDirSize = (dirPath) => {
      if (!fs.existsSync(dirPath)) return 0;
      let totalSize = 0;
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        if (file.endsWith('.png')) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          totalSize += stat.size;
        }
      });
      return totalSize;
    };
    
    stats.skins = countFiles(`${basePath}/skins`);
    stats.custom = countFiles(`${basePath}/custom/popular`) + countFiles(`${basePath}/custom/trending`);
    stats.tshirts = countFiles(`${basePath}/tshirts`);
    stats.lambo = countFiles(`${basePath}/lambo`);
    stats.total = stats.skins + stats.custom + stats.tshirts + stats.lambo;
    
    stats.totalSize = getDirSize(`${basePath}/skins`) + 
                     getDirSize(`${basePath}/custom/popular`) + 
                     getDirSize(`${basePath}/custom/trending`) + 
                     getDirSize(`${basePath}/tshirts`) + 
                     getDirSize(`${basePath}/lambo`);
    
  } catch (error) {
    console.error('[pregen] Error getting pregeneration stats:', error);
  }
  
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
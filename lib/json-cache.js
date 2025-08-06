// Sistema de caché para archivos JSON
const jsonCache = new Map();

// TTL de 7 días para archivos JSON (son estáticos)
const JSON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días en millisegundos

/**
 * Obtiene un archivo JSON cacheado
 * @param {string} filePath - Ruta del archivo JSON
 * @returns {Promise<Object|null>} - Contenido del JSON o null si no está cacheado
 */
export async function getCachedJson(filePath) {
  if (!jsonCache.has(filePath)) return null;
  
  const { data, expiry } = jsonCache.get(filePath);
  
  if (expiry < Date.now()) {
    jsonCache.delete(filePath);
    return null;
  }
  
  console.log(`[json-cache] 🎯 CACHE HIT: ${filePath}`);
  return data;
}

/**
 * Guarda un archivo JSON en caché
 * @param {string} filePath - Ruta del archivo JSON
 * @param {Object} data - Datos del JSON
 */
export function setCachedJson(filePath, data) {
  jsonCache.set(filePath, {
    data,
    expiry: Date.now() + JSON_CACHE_TTL
  });
  console.log(`[json-cache] 💾 CACHE MISS: ${filePath} (${Object.keys(data).length} entries)`);
}

/**
 * Limpia el caché completo de JSON
 * @returns {number} - Número de archivos eliminados
 */
export function clearJsonCache() {
  const size = jsonCache.size;
  jsonCache.clear();
  console.log(`[json-cache] 🧹 Caché de JSON limpiado (${size} archivos eliminados)`);
  return size;
}

/**
 * Obtiene estadísticas del caché de JSON
 * @returns {Object} - Estadísticas del caché
 */
export function getJsonCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let totalSize = 0;
  
  for (const [key, { data, expiry }] of jsonCache.entries()) {
    totalSize += JSON.stringify(data).length;
    if (expiry > now) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalFiles: jsonCache.size,
    validFiles: validEntries,
    expiredFiles: expiredEntries,
    memoryUsage: `${Math.round(totalSize / 1024)}KB`,
    ttl: `${Math.round(JSON_CACHE_TTL / (1000 * 60 * 60 * 24))} días`
  };
}

/**
 * Limpia entradas expiradas del caché de JSON
 * @returns {number} - Número de archivos expirados eliminados
 */
export function cleanupExpiredJsonEntries() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, { expiry }] of jsonCache.entries()) {
    if (expiry <= now) {
      jsonCache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[json-cache] 🧹 Limpieza automática: ${deletedCount} archivos JSON expirados eliminados`);
  }
  
  return deletedCount;
}

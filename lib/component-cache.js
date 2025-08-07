// Sistema de caché para componentes de renderizado
const componentCache = new Map();
const COMPONENT_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene un componente cacheado
 * @param {string} componentType - Tipo de componente (background, skin, trait)
 * @param {string} componentId - ID del componente
 * @returns {Buffer|null} - Imagen buffer o null si no está cacheado
 */
export function getCachedComponent(componentType, componentId) {
  const key = `${componentType}_${componentId}`;
  
  if (!componentCache.has(key)) return null;
  
  const { imageBuffer, expiry } = componentCache.get(key);
  
  if (expiry < Date.now()) {
    componentCache.delete(key);
    return null;
  }
  
  console.log(`[component-cache] 🎯 CACHE HIT: ${componentType}_${componentId} (${imageBuffer.length} bytes)`);
  return imageBuffer;
}

/**
 * Guarda un componente en caché
 * @param {string} componentType - Tipo de componente
 * @param {string} componentId - ID del componente
 * @param {Buffer} imageBuffer - Buffer de la imagen
 */
export function setCachedComponent(componentType, componentId, imageBuffer) {
  const key = `${componentType}_${componentId}`;
  
  componentCache.set(key, {
    imageBuffer,
    expiry: Date.now() + COMPONENT_TTL
  });
  
  console.log(`[component-cache] 💾 CACHE MISS: ${componentType}_${componentId} (${imageBuffer.length} bytes)`);
}

/**
 * Limpia el caché completo de componentes
 * @returns {number} - Número de componentes eliminados
 */
export function clearComponentCache() {
  const size = componentCache.size;
  componentCache.clear();
  console.log(`[component-cache] 🧹 Caché de componentes limpiado (${size} componentes eliminados)`);
  return size;
}

/**
 * Obtiene estadísticas del caché de componentes
 * @returns {Object} - Estadísticas del caché
 */
export function getComponentCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let totalSize = 0;
  let backgroundCount = 0;
  let skinCount = 0;
  let traitCount = 0;
  
  for (const [key, { imageBuffer, expiry }] of componentCache.entries()) {
    totalSize += imageBuffer.length;
    
    if (expiry > now) {
      validEntries++;
      if (key.startsWith('background_')) backgroundCount++;
      else if (key.startsWith('skin_')) skinCount++;
      else if (key.startsWith('trait_')) traitCount++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalComponents: componentCache.size,
    validComponents: validEntries,
    expiredComponents: expiredEntries,
    backgroundComponents: backgroundCount,
    skinComponents: skinCount,
    traitComponents: traitCount,
    memoryUsage: `${Math.round(totalSize / 1024)}KB`,
    ttl: `${Math.round(COMPONENT_TTL / (1000 * 60 * 60))} horas`
  };
}

/**
 * Limpia entradas expiradas del caché de componentes
 * @returns {number} - Número de componentes expirados eliminados
 */
export function cleanupExpiredComponentEntries() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, { expiry }] of componentCache.entries()) {
    if (expiry <= now) {
      componentCache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[component-cache] 🧹 Limpieza automática: ${deletedCount} componentes expirados eliminados`);
  }
  
  return deletedCount;
} 
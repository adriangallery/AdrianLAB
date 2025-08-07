// Sistema de caché para conversiones SVG → PNG
const svgPngCache = new Map();
const SVG_PNG_TTL = 24 * 60 * 60 * 1000; // 24 horas

import { createHash } from 'crypto';

/**
 * Obtiene una conversión SVG→PNG cacheada
 * @param {string} svgContent - Contenido del SVG
 * @returns {Buffer|null} - PNG buffer o null si no está cacheado
 */
export function getCachedSvgPng(svgContent) {
  const hash = createHash('md5').update(svgContent).digest('hex');
  
  if (!svgPngCache.has(hash)) return null;
  
  const { pngBuffer, expiry } = svgPngCache.get(hash);
  
  if (expiry < Date.now()) {
    svgPngCache.delete(hash);
    return null;
  }
  
  console.log(`[svg-png-cache] 🎯 CACHE HIT: SVG→PNG (${pngBuffer.length} bytes)`);
  return pngBuffer;
}

/**
 * Guarda una conversión SVG→PNG en caché
 * @param {string} svgContent - Contenido del SVG
 * @param {Buffer} pngBuffer - Buffer del PNG
 */
export function setCachedSvgPng(svgContent, pngBuffer) {
  const hash = createHash('md5').update(svgContent).digest('hex');
  
  svgPngCache.set(hash, {
    pngBuffer,
    expiry: Date.now() + SVG_PNG_TTL
  });
  
  console.log(`[svg-png-cache] 💾 CACHE MISS: SVG→PNG (${pngBuffer.length} bytes)`);
}

/**
 * Limpia el caché completo de SVG→PNG
 * @returns {number} - Número de conversiones eliminadas
 */
export function clearSvgPngCache() {
  const size = svgPngCache.size;
  svgPngCache.clear();
  console.log(`[svg-png-cache] 🧹 Caché SVG→PNG limpiado (${size} conversiones eliminadas)`);
  return size;
}

/**
 * Obtiene estadísticas del caché de SVG→PNG
 * @returns {Object} - Estadísticas del caché
 */
export function getSvgPngCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let totalSize = 0;
  
  for (const [key, { pngBuffer, expiry }] of svgPngCache.entries()) {
    totalSize += pngBuffer.length;
    if (expiry > now) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalConversions: svgPngCache.size,
    validConversions: validEntries,
    expiredConversions: expiredEntries,
    memoryUsage: `${Math.round(totalSize / 1024)}KB`,
    ttl: `${Math.round(SVG_PNG_TTL / (1000 * 60 * 60))} horas`
  };
}

/**
 * Limpia entradas expiradas del caché de SVG→PNG
 * @returns {number} - Número de conversiones expiradas eliminadas
 */
export function cleanupExpiredSvgPngEntries() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, { expiry }] of svgPngCache.entries()) {
    if (expiry <= now) {
      svgPngCache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[svg-png-cache] 🧹 Limpieza automática: ${deletedCount} conversiones SVG→PNG expiradas eliminadas`);
  }
  
  return deletedCount;
} 
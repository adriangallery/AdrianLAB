// Sistema de caché para toggles de ZoomInZEROS
const toggleCache = new Map(); // tokenId -> Set de toggleIds activos
let lastUpdate = 0;
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas en millisegundos

/**
 * Actualiza el caché de toggles si han pasado 24 horas desde la última actualización
 * @param {Object} zoomInZeros - Contrato ZoomInZEROS
 * @returns {Promise<void>}
 */
export async function updateTogglesIfNeeded(zoomInZeros) {
  const now = Date.now();
  
  // No actualizar si no han pasado 24 horas
  if (now - lastUpdate < UPDATE_INTERVAL) {
    console.log(`[toggle-cache] ⏰ No actualización necesaria. Próxima actualización en ${Math.round((UPDATE_INTERVAL - (now - lastUpdate)) / (1000 * 60 * 60))} horas`);
    return;
  }
  
  try {
    console.log('[toggle-cache] 🔄 Actualizando toggles activos...');
    const activeToggles = await zoomInZeros.getAllActiveToggles();
    
    // Limpiar caché anterior
    toggleCache.clear();
    
    // Procesar toggles activos
    let processedTokens = 0;
    for (const toggle of activeToggles) {
      const tokenId = toggle.tokenId.toString();
      const toggleId = toggle.toggleId.toString();
      
      // Crear Set si no existe para este token
      if (!toggleCache.has(tokenId)) {
        toggleCache.set(tokenId, new Set());
      }
      
      // Añadir toggle al token
      toggleCache.get(tokenId).add(toggleId);
      processedTokens++;
    }
    
    lastUpdate = now;
    console.log(`[toggle-cache] ✅ Toggles actualizados: ${processedTokens} tokens con toggles activos`);
    console.log(`[toggle-cache] 📊 Caché actualizado: ${toggleCache.size} tokens únicos`);
    
  } catch (error) {
    console.error('[toggle-cache] ❌ Error actualizando toggles:', error.message);
    // No modificar caché existente en caso de error (fallback seguro)
    console.log('[toggle-cache] 🔒 Manteniendo estado anterior del caché');
  }
}

/**
 * Verifica si un token tiene un toggle específico activo
 * @param {string|number} tokenId - ID del token
 * @param {string|number} toggleId - ID del toggle (default: "1" para closeup)
 * @returns {boolean} - true si el toggle está activo
 */
export function hasToggleActive(tokenId, toggleId = "1") {
  const toggles = toggleCache.get(tokenId.toString());
  const isActive = toggles ? toggles.has(toggleId.toString()) : false;
  
  console.log(`[toggle-cache] 🔍 Token ${tokenId} toggle ${toggleId}: ${isActive ? 'ACTIVO' : 'INACTIVO'}`);
  return isActive;
}

/**
 * Obtiene todos los toggles activos para un token
 * @param {string|number} tokenId - ID del token
 * @returns {Set<string>} - Set de toggleIds activos
 */
export function getActiveTogglesForToken(tokenId) {
  return toggleCache.get(tokenId.toString()) || new Set();
}

/**
 * Obtiene estadísticas del caché de toggles
 * @returns {Object} - Estadísticas del caché
 */
export function getToggleCacheStats() {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdate;
  const nextUpdateIn = UPDATE_INTERVAL - timeSinceLastUpdate;
  
  let tokensWithToggles = 0;
  let totalToggles = 0;
  
  for (const [tokenId, toggles] of toggleCache.entries()) {
    if (toggles.size > 0) {
      tokensWithToggles++;
      totalToggles += toggles.size;
    }
  }
  
  return {
    totalTokens: toggleCache.size,
    tokensWithToggles,
    totalToggles,
    lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : 'Nunca',
    nextUpdate: lastUpdate ? new Date(lastUpdate + UPDATE_INTERVAL).toISOString() : 'Inmediatamente',
    timeSinceLastUpdate: Math.round(timeSinceLastUpdate / (1000 * 60 * 60)) + ' horas',
    nextUpdateIn: Math.round(nextUpdateIn / (1000 * 60 * 60)) + ' horas'
  };
}

/**
 * Obtiene todos los tokens con toggles activos
 * @returns {Array} - Array de objetos {tokenId, toggles}
 */
export function getAllTokensWithToggles() {
  const result = [];
  for (const [tokenId, toggles] of toggleCache.entries()) {
    if (toggles.size > 0) {
      result.push({
        tokenId,
        toggles: Array.from(toggles)
      });
    }
  }
  return result;
}

/**
 * Limpia el caché de toggles
 * @returns {number} - Número de entradas eliminadas
 */
export function clearToggleCache() {
  const size = toggleCache.size;
  toggleCache.clear();
  lastUpdate = 0;
  console.log(`[toggle-cache] 🧹 Caché de toggles limpiado (${size} entradas eliminadas)`);
  return size;
}

/**
 * Fuerza la actualización del caché (ignora el intervalo de 24h)
 * @param {Object} zoomInZeros - Contrato ZoomInZEROS
 * @returns {Promise<void>}
 */
export async function forceUpdateToggles(zoomInZeros) {
  lastUpdate = 0; // Resetear para forzar actualización
  await updateTogglesIfNeeded(zoomInZeros);
}

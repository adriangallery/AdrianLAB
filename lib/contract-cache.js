// Sistema de caché para contratos blockchain
const contractCache = new Map();

// TTL de 24 horas para todas las llamadas
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas en millisegundos

/**
 * Genera una clave única para el caché
 * @param {string} contractName - Nombre del contrato
 * @param {string} functionName - Nombre de la función
 * @param {...any} args - Argumentos de la función
 * @returns {string} - Clave única del caché
 */
function generateCacheKey(contractName, functionName, ...args) {
  return `${contractName}:${functionName}:${args.join(':')}`;
}

/**
 * Wrapper para cachear llamadas al contrato
 * @param {Object} contract - Contrato de ethers
 * @param {string} contractName - Nombre del contrato
 * @param {string} functionName - Nombre de la función
 * @param {...any} args - Argumentos de la función
 * @returns {Promise<any>} - Resultado de la función
 */
export function cachedContractCall(contract, contractName, functionName, ...args) {
  const cacheKey = generateCacheKey(contractName, functionName, ...args);
  
  // Verificar caché
  if (contractCache.has(cacheKey)) {
    const { value, expiry } = contractCache.get(cacheKey);
    if (expiry > Date.now()) {
      console.log(`[contract-cache] 🎯 CACHE HIT: ${contractName}.${functionName}(${args.join(', ')})`);
      return Promise.resolve(value);
    }
    contractCache.delete(cacheKey);
  }
  
  // Llamada al contrato
  console.log(`[contract-cache] 💾 CACHE MISS: ${contractName}.${functionName}(${args.join(', ')})`);
  return contract[functionName](...args).then(result => {
    contractCache.set(cacheKey, {
      value: result,
      expiry: Date.now() + CACHE_TTL
    });
    return result;
  });
}

/**
 * Limpia el caché completo
 */
export function clearContractCache() {
  const size = contractCache.size;
  contractCache.clear();
  console.log(`[contract-cache] 🧹 Caché de contratos limpiado (${size} entradas eliminadas)`);
  return size;
}

/**
 * Limpia el caché para un token específico
 * @param {string|number} tokenId - ID del token
 * @returns {number} - Número de entradas eliminadas
 */
export function clearContractCacheForToken(tokenId) {
  const tokenIdStr = tokenId.toString();
  let deletedCount = 0;
  
  for (const [key] of contractCache.entries()) {
    if (key.includes(`:${tokenIdStr}:`) || key.endsWith(`:${tokenIdStr}`)) {
      contractCache.delete(key);
      deletedCount++;
    }
  }
  
  console.log(`[contract-cache] 🧹 Caché limpiado para token ${tokenId} (${deletedCount} entradas eliminadas)`);
  return deletedCount;
}

/**
 * Obtiene estadísticas del caché
 * @returns {Object} - Estadísticas del caché
 */
export function getContractCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  let totalSize = 0;
  
  for (const [key, { expiry }] of contractCache.entries()) {
    totalSize += key.length;
    if (expiry > now) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }
  
  return {
    totalEntries: contractCache.size,
    validEntries,
    expiredEntries,
    memoryUsage: `${Math.round(totalSize / 1024)}KB`,
    ttl: `${Math.round(CACHE_TTL / (1000 * 60 * 60))} horas`
  };
}

/**
 * Limpia entradas expiradas del caché
 * @returns {number} - Número de entradas expiradas eliminadas
 */
export function cleanupExpiredEntries() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [key, { expiry }] of contractCache.entries()) {
    if (expiry <= now) {
      contractCache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[contract-cache] 🧹 Limpieza automática: ${deletedCount} entradas expiradas eliminadas`);
  }
  
  return deletedCount;
}

/**
 * Crea un wrapper para un contrato con caché automático
 * @param {Object} contract - Contrato de ethers
 * @param {string} contractName - Nombre del contrato
 * @returns {Object} - Contrato con caché
 */
export function createCachedContract(contract, contractName) {
  const cachedContract = {};
  
  // Interceptar todas las funciones del contrato
  for (const [functionName, functionImpl] of Object.entries(contract.functions)) {
    if (typeof functionImpl === 'function') {
      cachedContract[functionName] = (...args) => {
        return cachedContractCall(contract, contractName, functionName, ...args);
      };
    }
  }
  
  // Copiar propiedades no-función
  for (const [key, value] of Object.entries(contract)) {
    if (typeof value !== 'function' && !cachedContract.hasOwnProperty(key)) {
      cachedContract[key] = value;
    }
  }
  
  return cachedContract;
} 
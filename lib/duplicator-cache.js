// Sistema de caché para DuplicatorMODULE
// Cachea información de duplicación de tokens para evitar llamadas repetidas al contrato

import { ethers } from 'ethers';

const duplicatorCache = new Map(); // tokenId -> { duplicated, sourceId, dupNumber, mintKind, mintedAt, to }

// ABI mínimo para llamada directa - CORREGIDO: sourceId es uint256, no string, y no es tuple anidada
const DUPLICATOR_ABI = [
  {
    "inputs": [{ "name": "tokenId", "type": "uint256" }],
    "name": "getDupInfo",
    "outputs": [
      { "name": "duplicated", "type": "bool" },
      { "name": "sourceId", "type": "uint256" },
      { "name": "dupNumber", "type": "uint8" },
      { "name": "mintKind", "type": "uint8" },
      { "name": "mintedAt", "type": "uint256" },
      { "name": "to", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const DUPLICATOR_ADDRESS = '0x70006742EC526d627a21fb3A8c458Eb5b46c3f54';

// RPC URLs para BASE (mismo orden que contracts.js)
const ALCHEMY_API_KEY_PRIMARY = process.env.ALCHEMY_API_KEY_PRIMARY;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
const ALCHEMY_API_KEY_FALLBACK = process.env.ALCHEMY_API_KEY_FALLBACK || "fgoABFGfYfI7yIPOSW7_bHPiXLQuHPjU";

// Crear provider para BASE
let cachedProvider = null;
async function getBaseProvider() {
  if (cachedProvider) {
    return cachedProvider;
  }

  const rpcUrls = [
    ALCHEMY_API_KEY_PRIMARY ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PRIMARY}` : null,
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_FALLBACK}`,
    'https://mainnet.base.org'
  ].filter(Boolean);

  for (const rpcUrl of rpcUrls) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        name: "Base Mainnet",
        chainId: 8453
      });
      await provider.getNetwork();
      console.log(`[duplicator-cache] ✅ Provider conectado a BASE via ${rpcUrl.includes('alchemy') ? 'Alchemy' : 'Base RPC'}`);
      cachedProvider = provider;
      return provider;
    } catch (error) {
      console.warn(`[duplicator-cache] ⚠️ Error con RPC ${rpcUrl.substring(0, 50)}...:`, error.message);
    }
  }

  throw new Error('No se pudo conectar a ningún RPC de BASE');
}
let cacheHits = 0;
let cacheMisses = 0;

// TTL del caché: 24 horas (la info de duplicación no cambia una vez creada)
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Obtiene información de duplicación de un token (con caché)
 * @param {Object} duplicatorModule - Contrato DuplicatorMODULE
 * @param {string|number} tokenId - ID del token
 * @returns {Promise<Object|null>} - Objeto con info de duplicación o null si hay error
 */
export async function getDupInfo(duplicatorModule, tokenId) {
  const tokenIdStr = tokenId.toString();

  // Verificar caché
  if (duplicatorCache.has(tokenIdStr)) {
    const cached = duplicatorCache.get(tokenIdStr);
    if (cached.expiry > Date.now()) {
      cacheHits++;
      console.log(`[duplicator-cache] 🎯 CACHE HIT para token ${tokenIdStr}`);
      return cached.data;
    }
    // Caché expirado, eliminar
    duplicatorCache.delete(tokenIdStr);
  }

  cacheMisses++;
  console.log(`[duplicator-cache] 💾 CACHE MISS para token ${tokenIdStr} - Consultando contrato...`);

  try {
    // Llamar al contrato - getDupInfo retorna (bool, DupInfo struct)
    const tokenIdNum = parseInt(tokenIdStr, 10);
    console.log(`[duplicator-cache] 🔍 Llamando getDupInfo con tokenId: ${tokenIdNum}`);

    // Obtener provider propio para BASE (no depender del contrato pasado)
    const provider = await getBaseProvider();

    // Crear contrato directamente
    const directContract = new ethers.Contract(DUPLICATOR_ADDRESS, DUPLICATOR_ABI, provider);
    console.log(`[duplicator-cache] 🔧 Llamando contrato ${DUPLICATOR_ADDRESS} en BASE`);

    const result = await directContract.getDupInfo(tokenIdNum);

    // Resultado es: (bool duplicated, uint256 sourceId, uint8 dupNumber, uint8 mintKind, uint256 mintedAt, address to)
    const dupInfo = {
      duplicated: result.duplicated,
      sourceId: result.sourceId.toString(),
      dupNumber: result.dupNumber,
      mintKind: result.mintKind,
      mintedAt: result.mintedAt.toString(),
      to: result.to
    };

    // Guardar en caché
    duplicatorCache.set(tokenIdStr, {
      data: dupInfo,
      expiry: Date.now() + CACHE_TTL
    });

    console.log(`[duplicator-cache] ✅ Info de duplicación obtenida para token ${tokenIdStr}:`, {
      duplicated: dupInfo.duplicated,
      dupNumber: dupInfo.dupNumber,
      sourceId: dupInfo.sourceId
    });

    return dupInfo;
  } catch (error) {
    // Si el contrato revierte, es probable que el token no esté registrado como duplicado
    // Cachear como "no duplicado" para evitar llamadas repetidas
    console.log(`[duplicator-cache] ⚠️ Token ${tokenIdStr} no está en el registro de duplicados (revert):`, error.message);

    const notDuplicatedInfo = {
      duplicated: false,
      sourceId: '',
      dupNumber: 0,
      mintKind: 0,
      mintedAt: '0',
      to: '0x0000000000000000000000000000000000000000'
    };

    // Cachear por menos tiempo (1 hora) para permitir actualizaciones más frecuentes
    duplicatorCache.set(tokenIdStr, {
      data: notDuplicatedInfo,
      expiry: Date.now() + (1 * 60 * 60 * 1000) // 1 hora
    });

    return notDuplicatedInfo;
  }
}

/**
 * Limpia el caché de duplicación
 * @returns {number} - Número de entradas eliminadas
 */
export function clearDuplicatorCache() {
  const size = duplicatorCache.size;
  duplicatorCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
  console.log(`[duplicator-cache] 🧹 Caché de duplicación limpiado (${size} entradas eliminadas)`);
  return size;
}

/**
 * Obtiene estadísticas del caché de duplicación
 * @returns {Object} - Estadísticas del caché
 */
export function getDuplicatorCacheStats() {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(2) : '0.00';

  return {
    entries: duplicatorCache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: `${hitRate}%`,
    ttlHours: CACHE_TTL / (60 * 60 * 1000)
  };
}

/**
 * Invalida una entrada específica del caché
 * @param {string|number} tokenId - ID del token a invalidar
 * @returns {boolean} - true si se eliminó la entrada, false si no existía
 */
export function invalidateDupInfo(tokenId) {
  const tokenIdStr = tokenId.toString();
  const existed = duplicatorCache.has(tokenIdStr);
  duplicatorCache.delete(tokenIdStr);
  if (existed) {
    console.log(`[duplicator-cache] 🗑️ Entrada invalidada para token ${tokenIdStr}`);
  }
  return existed;
}

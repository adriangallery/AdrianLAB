import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import AdrianLabCoreABI from './abis/AdrianLabCore.json';
import AdrianTraitsExtensionsABI from './abis/AdrianTraitsExtensions.json';
import AdrianTraitsCoreABI from './abis/AdrianTraitsCore.json';
import PatientZEROABI from './abis/PatientZERO.json';
import SerumModuleABI from './abis/SerumModule.json';
import AdrianNameRegistryABI from './abis/AdrianNameRegistry.json';
import ZoomInZEROSABI from './abis/ZoomInZEROS.json';
import DuplicatorMODULEABI from './abis/DuplicatorMODULE.json';
import { createCachedContract } from './contract-cache.js';

// Cargar SubZERO ABI usando fs para evitar problemas de build
let SubZEROABI = null;
function loadSubZEROABI() {
  if (!SubZEROABI) {
    try {
      const abiPath = path.join(process.cwd(), 'abis', 'SubZERO.json');
      const abiContent = fs.readFileSync(abiPath, 'utf8');
      SubZEROABI = JSON.parse(abiContent);
    } catch (error) {
      console.error('[contracts] Error cargando SubZERO ABI:', error);
      throw error;
    }
  }
  return SubZEROABI;
}

// Direcciones de contratos en Base
const CORE = '0x6E369BF0E4e0c106192D606FB6d85836d684DA75';
const TRAITS_EXTENSION = '0x0995c0da1ca071b792e852b6ec531b7cd7d1f8d6';
const TRAITS_CORE = '0x90546848474FB3c9fda3fdAd887969bB244E7e58';
const PATIENT_ZERO = '0x41bd1d621f9a8de8f175dd9814d9c27fabb9172f';
const SERUM_MODULE = '0xEb84a51F8d59d1C55cACFd15074AeB104D82B2ec';
const ADRIAN_NAME_REGISTRY = '0xaeC5ED33c88c1943BB7452aC4B571ad0b4c4068C';
const ZOOMIN_ZEROS = '0x568933634be4027339c80F126C91742d41A515A0';
const SUBZERO_DEPLOYER = '0x20700BE61f2b94E08B16ebD82eE0BA46189B7305';
export const BATCH_DEPLOYER = '0xA988F323023F12812c0BaD74d6C55CE07325d218';
// SamuraiMintFacet lives on the $ZERO Diamond. Implements the same deployer-compat
// interface (wasMintedHere / getTokenTag / getTokensByTag), so we reuse SubZEROABI.
export const ZERO_DIAMOND_DEPLOYER = '0x542b2B96E9c944260722a86C2ee76166A8e3D0A0';
const DUPLICATOR_MODULE = '0x70006742EC526d627a21fb3A8c458Eb5b46c3f54';

// Configuration - Usar variables de entorno con fallbacks para desarrollo local
// Nueva API key de Alchemy (primera opción)
const ALCHEMY_API_KEY_PRIMARY = process.env.ALCHEMY_API_KEY_PRIMARY;
const ALCHEMY_RPC_URL_PRIMARY = ALCHEMY_API_KEY_PRIMARY 
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_PRIMARY}`
  : null;

// Alchemy principal (segunda opción - fallback)
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "5qIXA1UZxOAzi8b9l0nrYmsQBO9-W7Ot";
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Alchemy Fallback (tercera opción)
const ALCHEMY_API_KEY_FALLBACK = process.env.ALCHEMY_API_KEY_FALLBACK || "fgoABFGfYfI7yIPOSW7_bHPiXLQuHPjU";
const ALCHEMY_RPC_URL_FALLBACK = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_FALLBACK}`;

// Infura (cuarta opción)
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID || "cc0c8013b1e044dcba79d4f7ec3b2ba1";
const INFURA_RPC_URL = `https://base-mainnet.infura.io/v3/${INFURA_PROJECT_ID}`;

// Network configuration
const BASE_NETWORK = {
    chainId: "0x2105", // 8453 in hex
    chainName: "Base Mainnet",
    nativeCurrency: {
        name: "ETH",
        symbol: "ETH",
        decimals: 18,
    },
    rpcUrls: [ALCHEMY_RPC_URL_PRIMARY || ALCHEMY_RPC_URL],
    blockExplorerUrls: ["https://basescan.org/"],
};

// Sistema de fallback entre providers
// Orden: 1. ALCHEMY_API_KEY_PRIMARY (nueva) -> 2. ALCHEMY_API_KEY (actual principal) -> 3. ALCHEMY_API_KEY_FALLBACK (actual fallback) -> 4. Infura -> 5. Base RPC público

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms (${label})`)), ms)),
  ]);

async function getProvider() {
  const PROBE_TIMEOUT_MS = 3000;

  // 1. Intentar con Alchemy Primary (nueva key)
  if (ALCHEMY_RPC_URL_PRIMARY) {
    try {
      console.log('[contracts] Intentando conectar con Alchemy (PRIMARY - nueva key)...');
      const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL_PRIMARY, {
        name: "Base Mainnet",
        chainId: 8453
      });
      await withTimeout(provider.getNetwork(), PROBE_TIMEOUT_MS, 'PRIMARY');
      console.log('[contracts] ✅ Conexión exitosa con Alchemy (PRIMARY)');
      return provider;
    } catch (error) {
      console.warn('[contracts] ⚠️ Alchemy PRIMARY failed, trying Alchemy principal...', error.message);
    }
  } else {
    console.log('[contracts] ℹ️ ALCHEMY_API_KEY_PRIMARY no configurada, saltando a siguiente opción...');
  }

  // 2. Intentar con Alchemy principal (actual)
  try {
    console.log('[contracts] Intentando conectar con Alchemy (principal)...');
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL, {
      name: "Base Mainnet",
      chainId: 8453
    });
    await withTimeout(provider.getNetwork(), PROBE_TIMEOUT_MS, 'principal');
    console.log('[contracts] ✅ Conexión exitosa con Alchemy (principal)');
    return provider;
  } catch (error) {
    console.warn('[contracts] ⚠️ Alchemy principal failed, trying Alchemy fallback...', error.message);
  }

  // 3. Intentar con Alchemy fallback
  try {
    console.log('[contracts] Intentando conectar con Alchemy (fallback)...');
    const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_RPC_URL_FALLBACK, {
      name: "Base Mainnet",
      chainId: 8453
    });
    await withTimeout(provider.getNetwork(), PROBE_TIMEOUT_MS, 'fallback');
    console.log('[contracts] ✅ Conexión exitosa con Alchemy (fallback)');
    return provider;
  } catch (error) {
    console.warn('[contracts] ⚠️ Alchemy fallback failed, trying Infura...', error.message);
  }

  // 4. Intentar con Infura
  try {
    console.log('[contracts] Intentando conectar con Infura...');
    const provider = new ethers.providers.JsonRpcProvider(INFURA_RPC_URL, {
      name: "Base Mainnet",
      chainId: 8453
    });
    await withTimeout(provider.getNetwork(), PROBE_TIMEOUT_MS, 'infura');
    console.log('[contracts] ✅ Conexión exitosa con Infura (fallback)');
    return provider;
  } catch (error) {
    console.error('[contracts] ❌ Infura también falló, usando Base RPC público...', error.message);
  }

  // 5. Último fallback al RPC público de Base
  console.log('[contracts] 🔄 Usando Base RPC público como último recurso...');
  return new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
}

// Función para inicializar los contratos
export async function getContracts() {
  try {
    // Validar ABIs
    if (!AdrianLabCoreABI || !Array.isArray(AdrianLabCoreABI)) {
      throw new Error('ABI de AdrianLabCore no válido');
    }
    if (!AdrianTraitsExtensionsABI || !Array.isArray(AdrianTraitsExtensionsABI)) {
      throw new Error('ABI de AdrianTraitsExtensions no válido');
    }
    if (!ZoomInZEROSABI || !Array.isArray(ZoomInZEROSABI)) {
      throw new Error('ABI de ZoomInZEROS no válido');
    }

    // Verificar función crítica getTokenData
    const hasGetTokenData = AdrianLabCoreABI.some(
      func => func.name === 'getTokenData' && 
              func.inputs?.length === 1 && 
              func.inputs[0].type === 'uint256' &&
              func.outputs?.length === 6 &&
              func.outputs[0].type === 'uint256' &&
              func.outputs[1].type === 'uint256' &&
              func.outputs[2].type === 'bool' &&
              func.outputs[3].type === 'uint256' &&
              func.outputs[4].type === 'uint256' &&
              func.outputs[5].type === 'bool'
    );

    // Verificar función crítica getAllEquippedTraits
    const hasGetAllEquippedTraits = AdrianTraitsExtensionsABI.some(
      func => func.name === 'getAllEquippedTraits' && 
              func.inputs?.length === 1 && 
              func.inputs[0].type === 'uint256' &&
              func.outputs?.length === 2 &&
              func.outputs[0].type === 'string[]' &&
              func.outputs[1].type === 'uint256[]'
    );

    if (!hasGetTokenData) {
      throw new Error('ABI de AdrianLabCore no contiene la función getTokenData con la firma correcta');
    }
    if (!hasGetAllEquippedTraits) {
      throw new Error('ABI de AdrianTraitsExtensions no contiene la función getAllEquippedTraits con la firma correcta');
    }

    // Verificar función crítica getAllActiveToggles
    const hasGetAllActiveToggles = ZoomInZEROSABI.some(
      func => func.name === 'getAllActiveToggles' && 
              func.inputs?.length === 0 &&
              func.outputs?.length === 1 &&
              func.outputs[0].type === 'tuple[]'
    );

    if (!hasGetAllActiveToggles) {
      throw new Error('ABI de ZoomInZEROS no contiene la función getAllActiveToggles con la firma correcta');
    }

    // Obtener provider con fallback
    const provider = await getProvider();
    
    // Inicializar contratos base
    const coreBase = new ethers.Contract(
      CORE,
      AdrianLabCoreABI,
      provider
    );

    const traitsExtensionBase = new ethers.Contract(
      TRAITS_EXTENSION,
      AdrianTraitsExtensionsABI,
      provider
    );

    const patientZeroBase = new ethers.Contract(
      PATIENT_ZERO,
      PatientZEROABI,
      provider
    );

    const serumModuleBase = new ethers.Contract(
      SERUM_MODULE,
      SerumModuleABI,
      provider
    );

    const adrianNameRegistryBase = new ethers.Contract(
      ADRIAN_NAME_REGISTRY,
      AdrianNameRegistryABI,
      provider
    );

    const traitsCoreBase = new ethers.Contract(
      TRAITS_CORE,
      AdrianTraitsCoreABI,
      provider
    );

    const zoomInZerosBase = new ethers.Contract(
      ZOOMIN_ZEROS,
      ZoomInZEROSABI,
      provider
    );

    const duplicatorModuleBase = new ethers.Contract(
      DUPLICATOR_MODULE,
      DuplicatorMODULEABI,
      provider
    );

    // Crear contratos con caché automático
    const core = createCachedContract(coreBase, 'core');
    const traitsExtension = createCachedContract(traitsExtensionBase, 'traitsExtension');
    const patientZero = createCachedContract(patientZeroBase, 'patientZero');
    const serumModule = createCachedContract(serumModuleBase, 'serumModule');
    const adrianNameRegistry = createCachedContract(adrianNameRegistryBase, 'adrianNameRegistry');
    const traitsCore = createCachedContract(traitsCoreBase, 'traitsCore');
    const zoomInZeros = createCachedContract(zoomInZerosBase, 'zoomInZeros');
    const duplicatorModule = createCachedContract(duplicatorModuleBase, 'duplicatorModule');

    // Test de funciones críticas
    try {
      console.log('[contracts] Probando función getTokenData...');
      const testTokenData = await core.getTokenData(1);
      console.log('[contracts] Test getTokenData exitoso:', {
        result: testTokenData.map(v => v.toString())
      });

      console.log('[contracts] Probando función getAllEquippedTraits...');
      const testTraits = await traitsExtension.getAllEquippedTraits(1);
      console.log('[contracts] Test getAllEquippedTraits exitoso:', {
        categories: testTraits[0],
        traitIds: testTraits[1].map(id => id.toString())
      });

      console.log('[contracts] Probando función getAllActiveToggles...');
      const testToggles = await zoomInZeros.getAllActiveToggles();
      console.log('[contracts] Test getAllActiveToggles exitoso:', {
        totalToggles: testToggles.length,
        toggles: testToggles.map(t => ({ tokenId: t.tokenId.toString(), toggleId: t.toggleId.toString() }))
      });
    } catch (error) {
      console.error('[contracts] Error en test de funciones:', error);
      // No lanzar error aquí para permitir que el contrato se inicialice
      // aunque el test falle
    }

    return { core, traitsExtension, traitsCore, patientZero, serumModule, adrianNameRegistry, zoomInZeros, duplicatorModule };
  } catch (error) {
    console.error('[contracts] Error inicializando contratos:', error);
    throw error;
  }
}

// Función para obtener el contrato SubZERO deployer
export async function getSubZeroDeployer() {
  try {
    const provider = await getProvider();
    const abi = loadSubZEROABI();
    const subZeroDeployerBase = new ethers.Contract(
      SUBZERO_DEPLOYER,
      abi,
      provider
    );
    return createCachedContract(subZeroDeployerBase, 'subZeroDeployer');
  } catch (error) {
    console.error('[contracts] Error inicializando SubZERO deployer:', error);
    throw error;
  }
}

// Función para obtener el contrato Batch Deployer (usado para SamuraiZERO)
export async function getBatchDeployer() {
  try {
    const provider = await getProvider();
    const abi = loadSubZEROABI(); // Usa el mismo ABI que SubZERO
    const batchDeployerBase = new ethers.Contract(
      BATCH_DEPLOYER,
      abi,
      provider
    );
    return createCachedContract(batchDeployerBase, 'batchDeployer');
  } catch (error) {
    console.error('[contracts] Error inicializando Batch Deployer:', error);
    throw error;
  }
}

// Función para obtener el $ZERO Diamond como deployer (SamuraiMintFacet + ZEROmoviesFacet)
// Minimal ABI for cross-facet reads on the $ZERO Diamond. Each mint facet on the
// Diamond has different tokenomics (ZEROmovies = rental/buy; SamuraiMint = batch
// mint; future facets TBD) so they each expose their OWN uniquely-named readers
// instead of sharing the generic deployer interface. AdrianLAB merges the sources
// off-chain.
const DIAMOND_DEPLOYER_ABI = [
  // ZEROmoviesFacet (generic interface — covers movies only)
  'function wasMintedHere(uint256 tokenId) view returns (bool)',
  'function getTokenTag(uint256 tokenId) view returns (string)',
  'function getAllMintedTokens() view returns (uint256[])',

  // SamuraiMintFacet (samurai-prefixed to avoid selector collision)
  'function samuraiWasMintedHere(uint256 tokenId) view returns (bool)',
  'function samuraiGetTokenTag(uint256 tokenId) view returns (string)',
  'function samuraiGetAllMintedTokens() view returns (uint256[])',

  // Shared across facets (registered by SamuraiMintFacet, isolated per facet storage)
  'function getTokensByTag(string tag) view returns (uint256[])',

  // SamuraiDojoFacet — persistent per-token honor accumulated across Budokais
  'function getHonor(uint256 tokenId) view returns (uint32)',
];

export async function getDiamondDeployer() {
  try {
    const provider = await getProvider();
    const diamondBase = new ethers.Contract(
      ZERO_DIAMOND_DEPLOYER,
      DIAMOND_DEPLOYER_ABI,
      provider
    );
    return createCachedContract(diamondBase, 'diamondDeployer');
  } catch (error) {
    console.error('[contracts] Error inicializando Diamond deployer:', error);
    throw error;
  }
}

/**
 * Reads persistent Honor for a token from SamuraiDojoFacet on the Diamond.
 * Honor accumulates across Budokais (champion +10, runner-up +5, semis +2, etc.)
 * and stacks with Senryoku in combat. Returns 0 on read failure so metadata
 * generation never blocks on RPC issues.
 */
export async function getTokenHonor(tokenId) {
  try {
    const diamond = await getDiamondDeployer();
    const honor = await diamond.getHonor(tokenId);
    return Number(honor);
  } catch (error) {
    console.error(`[contracts] getHonor(${tokenId}) failed:`, error.message);
    return 0;
  }
}

// Función helper para obtener el tag de un token
// Intenta en orden: SubZERO → BatchDeployer → $ZERO Diamond (SamuraiMintFacet)
export async function getTokenTag(tokenId) {
  try {
    // 1. SubZERO deployer (legacy SubZERO tag)
    const subZeroDeployer = await getSubZeroDeployer();
    const wasMintedSubZero = await subZeroDeployer.wasMintedHere(tokenId);

    if (wasMintedSubZero) {
      const tag = await subZeroDeployer.getTokenTag(tokenId);
      if (tag && tag.trim() !== '') {
        return { isMinted: true, tag: tag.trim(), deployer: 'SubZERO' };
      }
      return { isMinted: true, tag: null, deployer: 'SubZERO' };
    }

    // 2. Batch Deployer (legacy SamuraiZERO + AdrianZERO pre-migration)
    const batchDeployer = await getBatchDeployer();
    const wasMintedBatch = await batchDeployer.wasMintedHere(tokenId);

    if (wasMintedBatch) {
      const tag = await batchDeployer.getTokenTag(tokenId);
      if (tag && tag.trim() !== '') {
        return { isMinted: true, tag: tag.trim(), deployer: 'Batch' };
      }
      return { isMinted: true, tag: null, deployer: 'Batch' };
    }

    // 3. $ZERO Diamond — each facet stores its own tokens independently.
    //    Check every mint-facet source. Order matters: more-specific facets first
    //    (SamuraiMint stores richer tags like "SamuraiZERO"/"ZEROS"), then the
    //    generic ZEROmovies which implicitly tags everything "ZEROmovies".
    const diamondDeployer = await getDiamondDeployer();

    //    3a. SamuraiMintFacet (SamuraiZERO, ZEROS, future samurai batches)
    const wasMintedSamurai = await diamondDeployer.samuraiWasMintedHere(tokenId);
    if (wasMintedSamurai) {
      const tag = await diamondDeployer.samuraiGetTokenTag(tokenId);
      if (tag && tag.trim() !== '') {
        return { isMinted: true, tag: tag.trim(), deployer: 'Diamond:SamuraiMint' };
      }
      return { isMinted: true, tag: null, deployer: 'Diamond:SamuraiMint' };
    }

    //    3b. ZEROmoviesFacet
    const wasMintedMovies = await diamondDeployer.wasMintedHere(tokenId);
    if (wasMintedMovies) {
      const tag = await diamondDeployer.getTokenTag(tokenId);
      if (tag && tag.trim() !== '') {
        return { isMinted: true, tag: tag.trim(), deployer: 'Diamond:ZEROmovies' };
      }
      return { isMinted: true, tag: 'ZEROmovies', deployer: 'Diamond:ZEROmovies' };
    }

    return { isMinted: false, tag: null, deployer: null };
  } catch (error) {
    console.error(`[contracts] Error obteniendo tag para token ${tokenId}:`, error.message);
    return { isMinted: false, tag: null, deployer: null };
  }
}

// Caché para getTokensByTag (TTL corto - nuevos mints pueden cambiar el orden)
// NO usar caché largo porque cuando se mintean nuevos tokens, el orden cambia
// y necesitamos detectar los nuevos mints inmediatamente
const tokensByTagCache = new Map();
const TOKENS_BY_TAG_CACHE_TTL = 60 * 1000; // 1 minuto - solo para evitar llamadas repetidas en la misma request

// Merge deterministic: concatenates two tokenId lists, dedupes and sorts ascending.
// Used so the ordinal index of a tag-scoped SVG (e.g. SamuraiZERO 500-1099)
// stays consistent when mints happen across multiple deployer contracts.
function _mergeTokenIdLists(listA, listB) {
  const seen = new Set();
  const merged = [];
  for (const id of [...(listA || []), ...(listB || [])]) {
    const key = id.toString();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(id);
    }
  }
  return merged.sort((a, b) => {
    const aNum = typeof a === 'bigint' ? a : BigInt(a.toString());
    const bNum = typeof b === 'bigint' ? b : BigInt(b.toString());
    if (aNum < bNum) return -1;
    if (aNum > bNum) return 1;
    return 0;
  });
}

// Función helper para obtener todos los tokenIds con un tag específico.
// SamuraiZERO y AdrianZERO viven en DOS deployers tras la migración al Diamond:
//   - BatchDeployer   → históricos (pre-migración, e.g. los 196/600 originales)
//   - Diamond         → nuevos mints vía SamuraiMintFacet
// Se mergean por tokenId ascendente para que el índice ordinal del render quede estable.
// El resto de tags (SubZERO, ZEROmovies, …) viven en un único deployer.
export async function getTokensByTag(tag) {
  try {
    const cacheKey = `tokensByTag:${tag}`;

    if (tokensByTagCache.has(cacheKey)) {
      const { value, expiry } = tokensByTagCache.get(cacheKey);
      if (expiry > Date.now()) {
        console.log(`[contracts] 🎯 CACHE HIT (corto): getTokensByTag('${tag}')`);
        return value;
      }
      tokensByTagCache.delete(cacheKey);
    }

    let tokenIds = [];

    if (tag === 'SamuraiZERO' || tag === 'ZEROS') {
      // Merge legacy BatchDeployer + Diamond for migrated mints.
      // Note: batch 2's tag on-chain is "ZEROS" (the name the BatchDeployer was
      // configured with), not "AdrianZERO". The Diamond facet must mint with the
      // same string to keep the merge coherent.
      console.log(`[contracts] 💾 Consultando BatchDeployer + Diamond: getTokensByTag('${tag}')`);
      const [batchDeployer, diamondDeployer] = await Promise.all([
        getBatchDeployer(),
        getDiamondDeployer(),
      ]);
      const [batchIds, diamondIds] = await Promise.all([
        batchDeployer.getTokensByTag(tag).catch((e) => {
          console.warn(`[contracts] BatchDeployer getTokensByTag('${tag}') fallback:`, e.message);
          return [];
        }),
        diamondDeployer.getTokensByTag(tag).catch((e) => {
          console.warn(`[contracts] Diamond getTokensByTag('${tag}') fallback:`, e.message);
          return [];
        }),
      ]);
      tokenIds = _mergeTokenIdLists(batchIds, diamondIds);
      console.log(`[contracts] 🔀 merge '${tag}': ${batchIds.length} (batch) + ${diamondIds.length} (diamond) = ${tokenIds.length}`);
    } else if (tag === 'ZEROmovies') {
      // ZEROmovies only ever lived on the Diamond
      console.log(`[contracts] 💾 Consultando Diamond: getTokensByTag('${tag}')`);
      const diamondDeployer = await getDiamondDeployer();
      tokenIds = await diamondDeployer.getTokensByTag(tag);
    } else {
      // Legacy tags (SubZERO, …)
      console.log(`[contracts] 💾 Consultando SubZERO Deployer: getTokensByTag('${tag}')`);
      const subZeroDeployer = await getSubZeroDeployer();
      tokenIds = await subZeroDeployer.getTokensByTag(tag);
    }

    tokensByTagCache.set(cacheKey, {
      value: tokenIds,
      expiry: Date.now() + TOKENS_BY_TAG_CACHE_TTL
    });

    console.log(`[contracts] ✅ getTokensByTag('${tag}') retornó ${tokenIds.length} tokens`);
    return tokenIds;
  } catch (error) {
    console.error(`[contracts] Error obteniendo tokens por tag '${tag}':`, error.message);
    return [];
  }
}
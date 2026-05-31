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

// ─── Multi-URL rotating provider (ported from zero-keeper's RotatingProvider) ───
//
// AdrianLAB used to pick a SINGLE RPC URL by priority with NO runtime failover.
// When the chosen Alchemy app went inactive ("App is inactive", HTTP 403) the
// whole render died with `could not detect network` — even though base.org was
// in the priority list, it was never reached because the dead key was still
// "set" and won priority. (May 2026 incident: blanked every on-chain render.)
//
// This rotator round-robins across ALL candidate endpoints and BANS a bad one
// (24h on quota/auth/inactive, ~1s on rate-limit, 30s on transient) before
// retrying the next — so a dead key is harmless and base.org is always a live
// floor. Matches the bots' resilient pattern.

// Static network → ethers v5 skips the getNetwork() probe per sub-provider
// (the probe is what raised "could not detect network" when the key was dead).
const BASE_NETWORK = { name: 'Base Mainnet', chainId: 8453 };

const QUOTA_BAN_MS = 24 * 60 * 60 * 1000;
const TRANSIENT_BAN_MS = 30 * 1000;
const RATE_LIMIT_BAN_MS = 5 * 1000;
const REQUEST_TIMEOUT_MS = 5000; // per-RPC-request timeout (ethers v5 default is 120s)
const QUOTA_PATTERNS = [/monthly capacity/i, /capacity limit/i, /app is inactive/i, /quota exceeded/i];

function _aliasFor(url) {
  const ak = url.match(/\/v2\/([A-Za-z0-9_-]+)/);
  if (ak) return `alchemy:${ak[1].slice(0, 6)}…`;
  const ik = url.match(/\/v3\/([A-Za-z0-9_-]+)/);
  if (ik) return `infura:${ik[1].slice(0, 6)}…`;
  try { return new URL(url).hostname; } catch { return url.slice(0, 30); }
}

// Build candidate endpoints. RPC_URLS=url1,url2,... (full URLs) takes precedence
// for the head of the pool; the individual ALCHEMY_* keys are also folded in;
// base.org is ALWAYS appended as the always-on floor. Deduped, falsy filtered.
function _buildRpcUrls() {
  const urls = [];
  for (const u of (process.env.RPC_URLS || '').split(',').map((s) => s.trim())) {
    if (u) urls.push(u);
  }
  const alchemy = (k) => k && `https://base-mainnet.g.alchemy.com/v2/${k}`;
  urls.push(alchemy(process.env.ALCHEMY_API_KEY_PRIMARY));
  urls.push(alchemy(process.env.ALCHEMY_API_KEY));
  urls.push(alchemy(process.env.ALCHEMY_API_KEY_FALLBACK));
  if (process.env.INFURA_PROJECT_ID) {
    urls.push(`https://base-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`);
  }
  urls.push('https://mainnet.base.org'); // always-on public floor
  return [...new Set(urls.filter(Boolean))];
}

class RotatingProvider extends ethers.providers.JsonRpcProvider {
  constructor(urls) {
    if (!urls || urls.length === 0) urls = ['https://mainnet.base.org'];
    super(urls[0], BASE_NETWORK);
    this._keys = urls.map((url) => ({
      url,
      alias: _aliasFor(url),
      bannedUntil: 0,
      // Per-request timeout: ethers v5 defaults to 120s, so a hung endpoint
      // (accepts the connection but never replies) would stall a render up to
      // the lambda's 300s limit. 5s fails fast → classified transient → banned
      // → rotate to a healthy endpoint instead of stalling.
      provider: new ethers.providers.JsonRpcProvider({ url, timeout: REQUEST_TIMEOUT_MS }, BASE_NETWORK),
    }));
    this._cursor = 0;
  }

  aliases() { return this._keys.map((k) => k.alias); }

  // STICKY: return the first healthy endpoint from the cursor and PARK the
  // cursor on it — every subsequent read reuses that same endpoint (low,
  // consistent latency) instead of round-robining across heterogeneous
  // endpoints (a render does dozens of sequential reads; round-robin would
  // pay the slowest endpoint's latency on a fraction of every render). The
  // cursor only moves when the current endpoint errors/times out (see send()).
  _currentHealthy() {
    const now = Date.now();
    for (let i = 0; i < this._keys.length; i++) {
      const idx = (this._cursor + i) % this._keys.length;
      if (this._keys[idx].bannedUntil <= now) {
        this._cursor = idx; // park here (sticky)
        return this._keys[idx];
      }
    }
    // All banned → return soonest-recovering (one-shot; caller backs off).
    return this._keys.reduce((s, k) => (k.bannedUntil < s.bannedUntil ? k : s));
  }

  // quota = key dead / over cap (24h ban). rate-limit = CU/s throttle (~1s).
  // transient = network/timeout (30s). fatal = real revert → surface as-is.
  _classify(err) {
    if (!err) return 'fatal';
    const text = [
      err.message, err.body, err.reason,
      err.error && err.error.message,
      err.serverError && err.serverError.message,
    ].filter(Boolean).join(' ').toLowerCase();
    const status = String(err.status ?? (err.error && err.error.code) ?? '');
    if (QUOTA_PATTERNS.some((p) => p.test(text))) return 'quota';
    if (/^(401|402|403)/.test(status) || /\b(401|402|403)\b/.test(text)) return 'quota';
    if (status === '429' || /\b429\b/.test(text) || /rate limit/.test(text) ||
        (text.includes('exceeded') && text.includes('compute units'))) return 'rate-limit';
    if (err.code === 'TIMEOUT' || err.code === 'NETWORK_ERROR' || err.code === 'SERVER_ERROR' ||
        text.includes('timeout') || text.includes('could not detect network') ||
        text.includes('network error') || text.includes('server error')) return 'transient';
    if (err.code === 'CALL_EXCEPTION' && err.reason == null && err.data == null) return 'transient';
    return 'fatal';
  }

  async send(method, params) {
    let lastErr = null;
    let allBannedTried = false;
    for (let attempt = 0; attempt < this._keys.length; attempt++) {
      const k = this._currentHealthy();
      const allBanned = this._keys.every((x) => x.bannedUntil > Date.now());
      if (allBanned) {
        if (allBannedTried) break;
        allBannedTried = true;
      }
      try {
        return await k.provider.send(method, params);
      } catch (err) {
        const kind = this._classify(err);
        if (kind === 'quota') k.bannedUntil = Date.now() + QUOTA_BAN_MS;
        else if (kind === 'rate-limit') k.bannedUntil = Date.now() + RATE_LIMIT_BAN_MS;
        else if (kind === 'transient') k.bannedUntil = Date.now() + TRANSIENT_BAN_MS;
        else throw err; // fatal: real revert, don't rotate
        // Move the sticky cursor OFF the failed endpoint so the next attempt
        // (and subsequent reads) land on the next healthy one.
        this._cursor = (this._cursor + 1) % this._keys.length;
        console.warn(`[contracts] rpc ${k.alias} ${kind} (${(err.message || '').slice(0, 80)}) — rotating`);
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('RotatingProvider: all RPC endpoints failed');
  }
}

// Provider singleton — reused across all getXxx() calls. The rotator itself is
// stateless w.r.t. requests (just bans), so a single instance per lambda is ideal.
let _cachedProvider = null;

// Exported so duplicator-cache.js and the v2 provider share ONE resilient pool
// instead of each building its own (previously hardcoded, now-dead) Alchemy provider.
export function getProvider() {
  if (!_cachedProvider) {
    _cachedProvider = new RotatingProvider(_buildRpcUrls());
    console.log(`[contracts] RPC pool: ${_cachedProvider.aliases().join(', ')}`);
  }
  return _cachedProvider;
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
    const provider = getProvider();
    
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
    const provider = getProvider();
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
    const provider = getProvider();
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
  // ZEROmoviesFacet S1 (generic interface — covers movies only)
  'function wasMintedHere(uint256 tokenId) view returns (bool)',
  'function getTokenTag(uint256 tokenId) view returns (string)',
  'function getAllMintedTokens() view returns (uint256[])',
  // ZEROmoviesFacet S1 — movie readers
  'function getTokenMovie(uint256 tokenId) view returns (uint256)',

  // ZEROmoviesFacet S2 (prefixed selectors to avoid S1 collision)
  'function movies2WasMintedHere(uint256 tokenId) view returns (bool)',
  'function movies2GetTokenMovie(uint256 tokenId) view returns (uint256)',
  // S2 combined reader: returns movieId + rental state in 1 call
  'function getMovie2RentalInfo(uint256 tokenId) view returns (uint256 movieId, uint256 rentedAt, address renter, bool permanent, bool isOverdue, uint256 daysOverdue, uint256 lateFeeOwed)',

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
    const provider = getProvider();
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

    //    3b. ZEROmoviesFacet2 (S2) — check before S1 so the more-specific tag wins
    const wasMintedMovies2 = await diamondDeployer.movies2WasMintedHere(tokenId);
    if (wasMintedMovies2) {
      return { isMinted: true, tag: 'ZEROmovies2', deployer: 'Diamond:ZEROmovies2' };
    }

    //    3c. ZEROmoviesFacet (S1)
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

// ===== ZEROmovies helpers (used by v1-metadata port) =====
// These call the Diamond directly using the already-cached diamondDeployer contract.
// Both functions return null on any RPC failure — callers must treat null as "not a movie".

/**
 * Fetch the S1 movieId for a token minted via ZEROmoviesFacet.
 * Returns a positive integer (1-26) or null.
 */
export async function getTokenMovieId(tokenId) {
  try {
    const diamond = await getDiamondDeployer();
    const id = await diamond.getTokenMovie(tokenId);
    const n = Number(id);
    return n > 0 ? n : null;
  } catch (error) {
    console.error(`[contracts] getTokenMovie(${tokenId}) failed:`, error.message);
    return null;
  }
}

/**
 * Fetch movieId + rental state for a token minted via ZEROmoviesFacet2 (S2).
 * Returns { movieId, isOverdue, daysOverdue } or null.
 * movieId is a positive integer (27-50).
 */
export async function getMovie2Info(tokenId) {
  try {
    const diamond = await getDiamondDeployer();
    const result = await diamond.getMovie2RentalInfo(tokenId);
    const movieId = Number(result.movieId || result[0]);
    if (!movieId) return null;
    return {
      movieId,
      isOverdue: Boolean(result.isOverdue ?? result[4]),
      daysOverdue: Number(result.daysOverdue || result[5]),
    };
  } catch (error) {
    console.error(`[contracts] getMovie2RentalInfo(${tokenId}) failed:`, error.message);
    return null;
  }
}
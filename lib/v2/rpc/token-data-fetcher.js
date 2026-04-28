// ============================================
// V2 Token Data Fetcher — 1 RPC call for everything
// ============================================
// Batches all required on-chain reads into a single Multicall3.
// Returns a normalized object with all data needed for render or metadata.

import { multicall } from './multicall.js';
import { CONTRACTS } from '../shared/constants.js';
import {
  encodeGetTokenData,
  encodeGetTokenSkin,
  encodeGetAllEquippedTraits,
  encodeGetDupInfo,
  encodeGetTokenSerumHistory,
  encodeWasMintedHere,
  encodeGetTokenTag,
  encodeGetTokenMovie,
  encodeGetRentalInfo,
  encodeGetLateFeeConfig,
  encodeGetTokenStatus,
  encodeGetTokenNameHistory,
  encodeSamuraiWasMintedHere,
  encodeSamuraiGetTokenTag,
  encodeMovies2WasMintedHere,
  encodeMovies2GetTokenTag,
  encodeMovies2GetTokenMovie,
  encodeGetMovie2RentalInfo,
} from './contracts.js';

/**
 * Fetch all on-chain data for a token in 1 RPC call via Multicall3.
 *
 * @param {number|string} tokenId
 * @param {Object} options
 * @param {boolean} options.includeMetadata - Also fetch name history + token status (for metadata endpoint)
 * @returns {Promise<TokenData>}
 */
export async function fetchAllTokenData(tokenId, { includeMetadata = false } = {}) {
  const id = parseInt(tokenId);

  // Build call batch — each Diamond facet has its own uniquely-named readers
  // because the generic wasMintedHere/getTokenTag selectors can only map to ONE
  // facet. ZEROmoviesFacet owns the generic ones; SamuraiMintFacet owns the
  // samurai-prefixed variants. Future facets follow the same pattern.
  const calls = [
    encodeGetTokenData(id),                                         // 0: tokenData
    encodeGetTokenSkin(id),                                         // 1: tokenSkin
    encodeGetAllEquippedTraits(id),                                 // 2: equippedTraits
    encodeGetDupInfo(id),                                           // 3: dupInfo
    encodeGetTokenSerumHistory(id),                                 // 4: serumHistory (may need parent later)
    encodeWasMintedHere(CONTRACTS.SUBZERO_DEPLOYER, id),            // 5: wasMintedSubZero
    encodeGetTokenTag(CONTRACTS.SUBZERO_DEPLOYER, id),              // 6: subZeroTag
    encodeWasMintedHere(CONTRACTS.BATCH_DEPLOYER, id),              // 7: wasMintedBatch
    encodeGetTokenTag(CONTRACTS.BATCH_DEPLOYER, id),                // 8: batchTag
    encodeWasMintedHere(CONTRACTS.ZERO_DIAMOND, id),                // 9: wasMintedMovies (ZEROmoviesFacet)
    encodeGetTokenTag(CONTRACTS.ZERO_DIAMOND, id),                  // 10: moviesTag
    encodeSamuraiWasMintedHere(id),                                 // 11: wasMintedSamurai (SamuraiMintFacet)
    encodeSamuraiGetTokenTag(id),                                   // 12: samuraiTag
    encodeMovies2WasMintedHere(id),                                 // 13: wasMintedMovies2 (ZEROmoviesFacet2)
    encodeMovies2GetTokenTag(id),                                   // 14: movies2Tag
  ];

  if (includeMetadata) {
    calls.push(
      encodeGetTokenStatus(id),                                     // 15: tokenStatus
      encodeGetTokenNameHistory(id),                                // 16: nameHistory
    );
  }

  const results = await multicall(calls);

  // --- Parse results ---
  const tokenData = parseTokenData(results[0]);
  const tokenSkin = parseTokenSkin(results[1]);
  const equippedTraits = parseEquippedTraits(results[2]);
  const dupInfo = parseDupInfo(results[3]);
  const serumHistory = parseSerumHistory(results[4]);
  const tagInfo = parseTagInfo(
    results[5], results[6],   // SubZERO
    results[7], results[8],   // BatchDeployer legacy
    results[9], results[10],  // Diamond / ZEROmoviesFacet
    results[11], results[12], // Diamond / SamuraiMintFacet
    results[13], results[14], // Diamond / ZEROmoviesFacet2
  );

  // If ZEROmovies (S1) or ZEROmovies2 (S2), fetch movieId + rental info (overdue detection)
  let movieId = null;
  let movieRental = null;
  if (tagInfo.tag === 'ZEROmovies') {
    movieId = await fetchMovieId(id);
    if (movieId !== null && movieId > 0) {
      movieRental = await fetchMovieRental(movieId);
    }
  } else if (tagInfo.tag === 'ZEROmovies2') {
    const m2 = await fetchMovie2(id);
    movieId = m2?.movieId ?? null;
    movieRental = m2?.rental ?? null;
  }

  let profileName = null;
  let nameHistory = null;
  let tokenStatus = null;

  if (includeMetadata) {
    tokenStatus = parseTokenStatus(results[15]);
    nameHistory = parseNameHistory(results[16]);

    // If token has a profile, we need a second call for the profile name
    if (tokenStatus && tokenStatus.hasProfile && tokenStatus.profileId > 0) {
      profileName = await fetchProfileName(tokenStatus.profileId);
    }
  }

  // --- Handle duplicated token: inherit skin from parent if skinId=0 ---
  let effectiveSkinId = tokenSkin.skinId;
  let effectiveSkinName = tokenSkin.skinName;

  if (dupInfo.duplicated && tokenSkin.skinId === 0 && dupInfo.sourceId > 0) {
    const parentSkin = await fetchParentSkin(dupInfo.sourceId);
    if (parentSkin) {
      effectiveSkinId = parentSkin.skinId;
      effectiveSkinName = parentSkin.skinName;
    }
  }

  // --- Handle serum: if duplicated, use parent's serum history ---
  let effectiveSerumHistory = serumHistory;
  if (dupInfo.duplicated && dupInfo.sourceId > 0) {
    effectiveSerumHistory = await fetchParentSerumHistory(dupInfo.sourceId);
  }

  const serum = processSerumHistory(effectiveSerumHistory);

  // --- Compute effective generation ---
  const generation = dupInfo.duplicated && dupInfo.dupNumber > 0
    ? dupInfo.dupNumber
    : tokenData.generation;

  return {
    tokenId: id,
    // Raw token data
    generation,
    originalGeneration: tokenData.generation,
    mutationLevel: tokenData.mutationLevel,
    canReplicate: tokenData.canReplicate,
    replicationCount: tokenData.replicationCount,
    lastReplication: tokenData.lastReplication,
    hasBeenModified: tokenData.hasBeenModified,
    // Skin
    skinId: tokenSkin.skinId,
    skinName: tokenSkin.skinName,
    effectiveSkinId,
    effectiveSkinName,
    // Traits
    categories: equippedTraits.categories,
    traitIds: equippedTraits.traitIds,
    // Duplicator
    dupInfo,
    // Serum
    serumHistory: effectiveSerumHistory,
    appliedSerum: serum.appliedSerum,
    serumFailed: serum.serumFailed,
    failedSerumType: serum.failedSerumType,
    hasAdrianGFSerum: serum.hasAdrianGFSerum,
    // Tags
    tagInfo,
    // ZEROmovies
    movieId,
    movieRental,
    // Metadata-only fields
    profileName,
    nameHistory,
    tokenStatus,
  };
}

// ===== ZEROmovies late-fee config cache =====
// gracePeriod controls when a rental is considered OVERDUE — set at facet init
// and only changes via admin setLateFeeConfig. Cache it in-memory for ~1h to
// avoid 1 extra RPC call per token render.
let _lateFeeConfigCache = null;
let _lateFeeConfigFetchedAt = 0;
const LATE_FEE_CONFIG_TTL_MS = 60 * 60 * 1000; // 1h

// ===== PARSERS =====

function parseTokenData(result) {
  if (!result.success) {
    console.warn('[fetcher] getTokenData failed:', result.error);
    return { generation: 0, mutationLevel: 0, canReplicate: false, replicationCount: 0, lastReplication: 0, hasBeenModified: false };
  }
  const d = result.data;
  return {
    generation: Number(d.generation),
    mutationLevel: Number(d.mutationLevel),
    canReplicate: d.canReplicate,
    replicationCount: Number(d.replicationCount),
    lastReplication: Number(d.lastReplication),
    hasBeenModified: d.hasBeenModified,
  };
}

function parseTokenSkin(result) {
  if (!result.success) {
    console.warn('[fetcher] getTokenSkin failed:', result.error);
    return { skinId: 0, skinName: '' };
  }
  return {
    skinId: Number(result.data.skinId),
    skinName: result.data.skinName,
  };
}

function parseEquippedTraits(result) {
  if (!result.success) {
    console.warn('[fetcher] getAllEquippedTraits failed:', result.error);
    return { categories: [], traitIds: [] };
  }
  return {
    categories: result.data.categories || result.data[0] || [],
    traitIds: (result.data.traitIds || result.data[1] || []).map(id => Number(id)),
  };
}

function parseDupInfo(result) {
  if (!result.success) {
    return { duplicated: false, sourceId: 0, dupNumber: 0, mintKind: 0, mintedAt: 0, to: '0x0000000000000000000000000000000000000000' };
  }
  const d = result.data;
  return {
    duplicated: d.duplicated,
    sourceId: Number(d.sourceId),
    dupNumber: Number(d.dupNumber),
    mintKind: Number(d.mintKind),
    mintedAt: Number(d.mintedAt),
    to: d.to,
  };
}

function parseSerumHistory(result) {
  if (!result.success || !result.data[0]) return [];
  return result.data[0].map(entry => ({
    serumId: Number(entry.serumId || entry[0]),
    success: entry.success ?? entry[1],
    timestamp: Number(entry.timestamp || entry[2]),
    mutation: entry.mutation || entry[3] || '',
  }));
}

function parseTagInfo(
  subZeroMinted, subZeroTag,
  batchMinted,   batchTag,
  moviesMinted,  moviesTag,
  samuraiMinted, samuraiTag,
  movies2Minted, movies2Tag
) {
  // 1. SubZERO deployer (legacy)
  if (subZeroMinted.success && subZeroMinted.data[0] === true) {
    const tag = subZeroTag.success ? (subZeroTag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || null, deployer: 'SubZERO' };
  }
  // 2. BatchDeployer (legacy SamuraiZERO / ZEROS pre-migration)
  if (batchMinted.success && batchMinted.data[0] === true) {
    const tag = batchTag.success ? (batchTag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || null, deployer: 'Batch' };
  }
  // 3a. Diamond / SamuraiMintFacet — post-migration samurai batches. Checked
  //     BEFORE ZEROmovies because future samurai-style facets may register
  //     more specific tags; movies is the catch-all "anything minted on the
  //     Diamond that isn't samurai-registered".
  if (samuraiMinted && samuraiMinted.success && samuraiMinted.data[0] === true) {
    const tag = samuraiTag && samuraiTag.success ? (samuraiTag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || null, deployer: 'Diamond:SamuraiMint' };
  }
  // 3b. Diamond / ZEROmoviesFacet2 (S2). Checked BEFORE S1 so that the more
  //     specific tag wins if both happen to claim a token (shouldn't happen,
  //     but defensive — selectors are prefixed so storage is isolated).
  if (movies2Minted && movies2Minted.success && movies2Minted.data[0] === true) {
    const tag = movies2Tag && movies2Tag.success ? (movies2Tag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || 'ZEROmovies2', deployer: 'Diamond:ZEROmovies2' };
  }
  // 3c. Diamond / ZEROmoviesFacet (S1)
  if (moviesMinted && moviesMinted.success && moviesMinted.data[0] === true) {
    const tag = moviesTag && moviesTag.success ? (moviesTag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || 'ZEROmovies', deployer: 'Diamond:ZEROmovies' };
  }
  return { isMinted: false, tag: null, deployer: null };
}

function parseTokenStatus(result) {
  if (!result || !result.success) return null;
  return {
    profileId: Number(result.data.profileId || result.data[0]),
    hasProfile: result.data.hasProfile ?? result.data[1],
  };
}

function parseNameHistory(result) {
  if (!result || !result.success || !result.data[0]) return [];
  return result.data[0].map(entry => ({
    name: entry.name || entry[0],
    timestamp: Number(entry.timestamp || entry[1]),
  }));
}

// ===== SERUM PROCESSING =====
// Reproduces the exact V1 serum state machine

function processSerumHistory(history) {
  if (!history || history.length === 0) {
    return { appliedSerum: null, serumFailed: false, failedSerumType: null, hasAdrianGFSerum: false };
  }

  let hasAdrianGFSerum = false;

  // Check full history for AdrianGF
  for (const entry of history) {
    if (entry.success === true && entry.mutation === 'AdrianGF') {
      hasAdrianGFSerum = true;
      break;
    }
  }

  // Process last serum entry
  const lastSerum = history[history.length - 1];

  if (lastSerum.success) {
    // Successful serum
    if (lastSerum.mutation) {
      return {
        appliedSerum: lastSerum.mutation,
        serumFailed: false,
        failedSerumType: null,
        hasAdrianGFSerum,
      };
    }
    // Success but no mutation name — shouldn't happen
    console.warn('[fetcher] Serum marked successful but no mutation');
    return { appliedSerum: null, serumFailed: false, failedSerumType: null, hasAdrianGFSerum };
  }

  // Failed serum
  let failedSerumType = lastSerum.mutation || null;
  if (!failedSerumType) {
    // Search history backwards for the serum type
    for (let i = history.length - 1; i >= 0; i--) {
      const m = history[i].mutation;
      if (m === 'AdrianGF' || m === 'GoldenAdrian') {
        failedSerumType = m;
        break;
      }
    }
  }

  return {
    appliedSerum: null,
    serumFailed: true,
    failedSerumType,
    hasAdrianGFSerum,
  };
}

// ===== SUPPLEMENTARY FETCHES (2nd Multicall if needed) =====

import {
  encodeGetTokenSkin as encodeSkin,
  encodeGetTokenSerumHistory as encodeSerumHist,
  encodeGetProfile as encodeProf,
} from './contracts.js';

async function fetchParentSkin(sourceId) {
  try {
    const [result] = await multicall([encodeSkin(sourceId)]);
    if (result.success) {
      return { skinId: Number(result.data.skinId), skinName: result.data.skinName };
    }
  } catch (err) {
    console.warn('[fetcher] Failed to fetch parent skin:', err.message);
  }
  return null;
}

async function fetchParentSerumHistory(sourceId) {
  try {
    const [result] = await multicall([encodeSerumHist(sourceId)]);
    return parseSerumHistory(result);
  } catch (err) {
    console.warn('[fetcher] Failed to fetch parent serum history:', err.message);
    return [];
  }
}

async function fetchMovieId(tokenId) {
  try {
    const [result] = await multicall([encodeGetTokenMovie(tokenId)]);
    if (result.success) {
      return Number(result.data[0]);
    }
  } catch (err) {
    console.warn('[fetcher] Failed to fetch movieId:', err.message);
  }
  return null;
}

/**
 * Fetch rental state for a ZEROmovies movieId. Used to detect OVERDUE tapes.
 * Combines getRentalInfo(movieId) with cached getLateFeeConfig() (gracePeriod).
 *
 * "Overdue" mirrors the on-chain late-fee mechanic: a rent is overdue once
 * elapsed > gracePeriod (default 5d on S1), at which point lateFeePerDay
 * starts accumulating. This is what the renter actually owes — not the
 * 30d keepThreshold which gates a different action (keepForever).
 *
 * Returns null on RPC failure — compositor falls back to non-overdue render.
 *
 * Shape:
 *   { rentedAt, currentRenter, permanent, isOverdue, daysOverdue }
 */
async function fetchMovieRental(movieId) {
  try {
    const calls = [encodeGetRentalInfo(movieId)];
    const fetchConfig =
      !_lateFeeConfigCache || (Date.now() - _lateFeeConfigFetchedAt) > LATE_FEE_CONFIG_TTL_MS;
    if (fetchConfig) calls.push(encodeGetLateFeeConfig());

    const results = await multicall(calls);
    const rentalRes = results[0];
    if (!rentalRes.success) return null;

    const r = rentalRes.data;
    const currentRenter = r.renter || r[0];
    const rentedAt = Number(r.rentedAt || r[2]);
    const permanent = Boolean(r.permanent ?? r[5]);

    if (fetchConfig && results[1] && results[1].success) {
      const c = results[1].data;
      _lateFeeConfigCache = { gracePeriod: Number(c.gracePeriod || c[0]) };
      _lateFeeConfigFetchedAt = Date.now();
    }
    const gracePeriod = _lateFeeConfigCache?.gracePeriod ?? (5 * 24 * 60 * 60); // 5d default

    const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
    const hasActiveRent = currentRenter && currentRenter !== ZERO_ADDR && !permanent;
    let isOverdue = false;
    let daysOverdue = 0;
    if (hasActiveRent && rentedAt > 0) {
      const nowSec = Math.floor(Date.now() / 1000);
      const overdueAt = rentedAt + gracePeriod;
      if (nowSec > overdueAt) {
        isOverdue = true;
        daysOverdue = Math.floor((nowSec - overdueAt) / 86400);
      }
    }

    return { rentedAt, currentRenter, permanent, isOverdue, daysOverdue };
  } catch (err) {
    console.warn('[fetcher] Failed to fetch movie rental:', err.message);
    return null;
  }
}

/**
 * Fetch movieId + rental info for a ZEROmovies2 token in 1 multicall.
 * S2 exposes `getMovie2RentalInfo(tokenId)` which returns both the movieId
 * and the rental state. Returns null on RPC failure.
 *
 * Shape (matches S1 movieRental for compositor reuse):
 *   { movieId, rental: { rentedAt, currentRenter, permanent, isOverdue, daysOverdue } }
 */
async function fetchMovie2(tokenId) {
  try {
    const [result] = await multicall([encodeGetMovie2RentalInfo(tokenId)]);
    if (!result.success) return null;
    const r = result.data;
    const movieId = Number(r.movieId || r[0]);
    if (!movieId) return null;
    const rentedAt = Number(r.rentedAt || r[1]);
    const renter = r.renter || r[2];
    const permanent = Boolean(r.permanent ?? r[3]);
    const isOverdue = Boolean(r.isOverdue ?? r[4]);
    const daysOverdue = Number(r.daysOverdue || r[5]);
    return {
      movieId,
      rental: { rentedAt, currentRenter: renter, permanent, isOverdue, daysOverdue },
    };
  } catch (err) {
    console.warn('[fetcher] Failed to fetch movie2 info:', err.message);
    return null;
  }
}

async function fetchProfileName(profileId) {
  try {
    const [result] = await multicall([encodeProf(profileId)]);
    if (result.success) {
      return result.data.name || result.data[0] || null;
    }
  } catch (err) {
    console.warn('[fetcher] Failed to fetch profile:', err.message);
  }
  return null;
}

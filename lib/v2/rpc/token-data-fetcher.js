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
  encodeGetTokenStatus,
  encodeGetTokenNameHistory,
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

  // Build call batch
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
  ];

  if (includeMetadata) {
    calls.push(
      encodeGetTokenStatus(id),                                     // 9: tokenStatus
      encodeGetTokenNameHistory(id),                                // 10: nameHistory
    );
  }

  const results = await multicall(calls);

  // --- Parse results ---
  const tokenData = parseTokenData(results[0]);
  const tokenSkin = parseTokenSkin(results[1]);
  const equippedTraits = parseEquippedTraits(results[2]);
  const dupInfo = parseDupInfo(results[3]);
  const serumHistory = parseSerumHistory(results[4]);
  const tagInfo = parseTagInfo(results[5], results[6], results[7], results[8]);

  let profileName = null;
  let nameHistory = null;

  if (includeMetadata) {
    const status = parseTokenStatus(results[9]);
    nameHistory = parseNameHistory(results[10]);

    // If token has a profile, we need a second call for the profile name
    if (status && status.hasProfile && status.profileId > 0) {
      profileName = await fetchProfileName(status.profileId);
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
    // Metadata-only fields
    profileName,
    nameHistory,
  };
}

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

function parseTagInfo(subZeroMinted, subZeroTag, batchMinted, batchTag) {
  // SubZERO check
  if (subZeroMinted.success && subZeroMinted.data[0] === true) {
    const tag = subZeroTag.success ? (subZeroTag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || null, deployer: 'SubZERO' };
  }
  // Batch (SamuraiZERO) check
  if (batchMinted.success && batchMinted.data[0] === true) {
    const tag = batchTag.success ? (batchTag.data[0] || '').trim() : '';
    return { isMinted: true, tag: tag || null, deployer: 'Batch' };
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

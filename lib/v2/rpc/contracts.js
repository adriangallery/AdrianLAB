// ============================================
// V2 Contracts — Minimal ABI fragments for Multicall3 encoding
// ============================================
// Only the function signatures we need for calldata encoding/decoding.
// No contract instances — we use raw calldata with Multicall3.

import { ethers } from 'ethers';
import { CONTRACTS } from '../shared/constants.js';

// ===== MINIMAL ABI FRAGMENTS =====

const CORE_ABI = [
  'function getTokenData(uint256 tokenId) view returns (uint256 generation, uint256 mutationLevel, bool canReplicate, uint256 replicationCount, uint256 lastReplication, bool hasBeenModified)',
  'function getTokenSkin(uint256 tokenId) view returns (uint256 skinId, string skinName)',
];

const TRAITS_EXT_ABI = [
  'function getAllEquippedTraits(uint256 tokenId) view returns (string[] categories, uint256[] traitIds)',
];

const DUPLICATOR_ABI = [
  'function getDupInfo(uint256 tokenId) view returns (bool duplicated, uint256 sourceId, uint8 dupNumber, uint8 mintKind, uint256 mintedAt, address to)',
];

const SERUM_ABI = [
  'function getTokenSerumHistory(uint256 tokenId) view returns (tuple(uint256 serumId, bool success, uint256 timestamp, string mutation)[])',
];

const DEPLOYER_ABI = [
  'function wasMintedHere(uint256 tokenId) view returns (bool)',
  'function getTokenTag(uint256 tokenId) view returns (string)',
  'function getTokensByTag(string tag) view returns (uint256[])',
];

const PATIENT_ZERO_ABI = [
  'function getTokenStatus(uint256 tokenId) view returns (uint256 profileId, bool hasProfile)',
  'function getProfile(uint256 profileId) view returns (string name, string avatar, uint256 createdAt)',
];

const NAME_REGISTRY_ABI = [
  'function getTokenNameHistory(uint256 tokenId) view returns (tuple(string name, uint256 timestamp)[])',
];

const ZEROMOVIES_ABI = [
  'function getTokenMovie(uint256 tokenId) view returns (uint256)',
  'function getRentalInfo(uint256 movieId) view returns (address renter, uint256 tokenId, uint256 rentedAt, uint256 deposit, uint256 rentals, bool permanent, string name)',
  'function getLateFeeConfig() view returns (uint256 gracePeriod, uint256 feePerDay)',
];

// SamuraiMintFacet lives on the Diamond alongside ZEROmoviesFacet but uses
// samurai-prefixed view functions (each facet has its own tokenomics so the
// generic deployer interface can't be shared). AdrianLAB merges sources off-chain.
const SAMURAI_MINT_ABI = [
  'function samuraiWasMintedHere(uint256 tokenId) view returns (bool)',
  'function samuraiGetTokenTag(uint256 tokenId) view returns (string)',
];

// SamuraiDojoFacet — persistent per-token honor accumulated across Budokais
// (champion +10, runner-up +5, semis +2, etc.). Lives on the same Diamond.
const SAMURAI_DOJO_ABI = [
  'function getHonor(uint256 tokenId) view returns (uint32)',
];

// ZEROmoviesFacet2 (Season 2) — same Diamond, prefixed selectors `movies2*` so
// it doesn't collide with S1. Uses asymmetric tokenomics (50/20/30) and renders
// from /labimages/zeromovies2/ with optional GIF overlay for animated movies.
const ZEROMOVIES2_ABI = [
  'function movies2WasMintedHere(uint256 tokenId) view returns (bool)',
  'function movies2GetTokenTag(uint256 tokenId) view returns (string)',
  'function movies2GetTokenMovie(uint256 tokenId) view returns (uint256)',
  'function getMovie2RentalInfo(uint256 tokenId) view returns (uint256 movieId, uint256 rentedAt, address renter, bool permanent, bool isOverdue, uint256 daysOverdue, uint256 lateFeeOwed)',
];

// GumballMintFacet — same Diamond, prefixed selectors `gumball*`.
// Tags are assigned at seed time (not at dispense time), so every tokenId in the
// 100-slot batch has tag 'GumballZERO' from the moment the facet seeds the batch.
// The architect wires gumballWasMintedHere / gumballGetTokenTag in parallel.
const GUMBALL_MINT_ABI = [
  'function gumballWasMintedHere(uint256 tokenId) view returns (bool)',
  'function gumballGetTokenTag(uint256 tokenId) view returns (string)',
];

const ZOOMIN_ABI = [
  'function getAllActiveToggles() view returns (tuple(uint256 tokenId, uint256 toggleId)[])',
];

// ===== INTERFACE INSTANCES (for encoding/decoding only) =====

export const iCore = new ethers.utils.Interface(CORE_ABI);
export const iTraitsExt = new ethers.utils.Interface(TRAITS_EXT_ABI);
export const iDuplicator = new ethers.utils.Interface(DUPLICATOR_ABI);
export const iSerum = new ethers.utils.Interface(SERUM_ABI);
export const iDeployer = new ethers.utils.Interface(DEPLOYER_ABI);
export const iPatientZero = new ethers.utils.Interface(PATIENT_ZERO_ABI);
export const iNameRegistry = new ethers.utils.Interface(NAME_REGISTRY_ABI);
export const iZEROmovies = new ethers.utils.Interface(ZEROMOVIES_ABI);
export const iSamuraiMint = new ethers.utils.Interface(SAMURAI_MINT_ABI);
export const iSamuraiDojo = new ethers.utils.Interface(SAMURAI_DOJO_ABI);
export const iZEROmovies2 = new ethers.utils.Interface(ZEROMOVIES2_ABI);
export const iGumballMint = new ethers.utils.Interface(GUMBALL_MINT_ABI);
export const iZoomin = new ethers.utils.Interface(ZOOMIN_ABI);

// ===== CALLDATA ENCODERS =====

export function encodeGetTokenData(tokenId) {
  return {
    target: CONTRACTS.CORE,
    callData: iCore.encodeFunctionData('getTokenData', [tokenId]),
    iface: iCore,
    fnName: 'getTokenData',
  };
}

export function encodeGetTokenSkin(tokenId) {
  return {
    target: CONTRACTS.CORE,
    callData: iCore.encodeFunctionData('getTokenSkin', [tokenId]),
    iface: iCore,
    fnName: 'getTokenSkin',
  };
}

export function encodeGetAllEquippedTraits(tokenId) {
  return {
    target: CONTRACTS.TRAITS_EXTENSION,
    callData: iTraitsExt.encodeFunctionData('getAllEquippedTraits', [tokenId]),
    iface: iTraitsExt,
    fnName: 'getAllEquippedTraits',
  };
}

export function encodeGetDupInfo(tokenId) {
  return {
    target: CONTRACTS.DUPLICATOR_MODULE,
    callData: iDuplicator.encodeFunctionData('getDupInfo', [tokenId]),
    iface: iDuplicator,
    fnName: 'getDupInfo',
  };
}

export function encodeGetTokenSerumHistory(tokenId) {
  return {
    target: CONTRACTS.SERUM_MODULE,
    callData: iSerum.encodeFunctionData('getTokenSerumHistory', [tokenId]),
    iface: iSerum,
    fnName: 'getTokenSerumHistory',
  };
}

export function encodeWasMintedHere(deployer, tokenId) {
  return {
    target: deployer,
    callData: iDeployer.encodeFunctionData('wasMintedHere', [tokenId]),
    iface: iDeployer,
    fnName: 'wasMintedHere',
  };
}

export function encodeGetTokenTag(deployer, tokenId) {
  return {
    target: deployer,
    callData: iDeployer.encodeFunctionData('getTokenTag', [tokenId]),
    iface: iDeployer,
    fnName: 'getTokenTag',
  };
}

export function encodeGetTokensByTag(deployer, tag) {
  return {
    target: deployer,
    callData: iDeployer.encodeFunctionData('getTokensByTag', [tag]),
    iface: iDeployer,
    fnName: 'getTokensByTag',
  };
}

export function encodeGetTokenStatus(tokenId) {
  return {
    target: CONTRACTS.PATIENT_ZERO,
    callData: iPatientZero.encodeFunctionData('getTokenStatus', [tokenId]),
    iface: iPatientZero,
    fnName: 'getTokenStatus',
  };
}

export function encodeGetProfile(profileId) {
  return {
    target: CONTRACTS.PATIENT_ZERO,
    callData: iPatientZero.encodeFunctionData('getProfile', [profileId]),
    iface: iPatientZero,
    fnName: 'getProfile',
  };
}

export function encodeGetTokenNameHistory(tokenId) {
  return {
    target: CONTRACTS.NAME_REGISTRY,
    callData: iNameRegistry.encodeFunctionData('getTokenNameHistory', [tokenId]),
    iface: iNameRegistry,
    fnName: 'getTokenNameHistory',
  };
}

export function encodeGetTokenMovie(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies.encodeFunctionData('getTokenMovie', [tokenId]),
    iface: iZEROmovies,
    fnName: 'getTokenMovie',
  };
}

export function encodeGetRentalInfo(movieId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies.encodeFunctionData('getRentalInfo', [movieId]),
    iface: iZEROmovies,
    fnName: 'getRentalInfo',
  };
}

export function encodeGetLateFeeConfig() {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies.encodeFunctionData('getLateFeeConfig', []),
    iface: iZEROmovies,
    fnName: 'getLateFeeConfig',
  };
}

export function encodeSamuraiWasMintedHere(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iSamuraiMint.encodeFunctionData('samuraiWasMintedHere', [tokenId]),
    iface: iSamuraiMint,
    fnName: 'samuraiWasMintedHere',
  };
}

export function encodeSamuraiGetTokenTag(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iSamuraiMint.encodeFunctionData('samuraiGetTokenTag', [tokenId]),
    iface: iSamuraiMint,
    fnName: 'samuraiGetTokenTag',
  };
}

export function encodeGetHonor(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iSamuraiDojo.encodeFunctionData('getHonor', [tokenId]),
    iface: iSamuraiDojo,
    fnName: 'getHonor',
  };
}

export function encodeMovies2WasMintedHere(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies2.encodeFunctionData('movies2WasMintedHere', [tokenId]),
    iface: iZEROmovies2,
    fnName: 'movies2WasMintedHere',
  };
}

export function encodeMovies2GetTokenTag(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies2.encodeFunctionData('movies2GetTokenTag', [tokenId]),
    iface: iZEROmovies2,
    fnName: 'movies2GetTokenTag',
  };
}

export function encodeMovies2GetTokenMovie(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies2.encodeFunctionData('movies2GetTokenMovie', [tokenId]),
    iface: iZEROmovies2,
    fnName: 'movies2GetTokenMovie',
  };
}

export function encodeGetMovie2RentalInfo(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iZEROmovies2.encodeFunctionData('getMovie2RentalInfo', [tokenId]),
    iface: iZEROmovies2,
    fnName: 'getMovie2RentalInfo',
  };
}

export function encodeGumballWasMintedHere(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iGumballMint.encodeFunctionData('gumballWasMintedHere', [tokenId]),
    iface: iGumballMint,
    fnName: 'gumballWasMintedHere',
  };
}

export function encodeGumballGetTokenTag(tokenId) {
  return {
    target: CONTRACTS.ZERO_DIAMOND,
    callData: iGumballMint.encodeFunctionData('gumballGetTokenTag', [tokenId]),
    iface: iGumballMint,
    fnName: 'gumballGetTokenTag',
  };
}

export function encodeGetAllActiveToggles() {
  return {
    target: CONTRACTS.ZOOMIN_ZEROS,
    callData: iZoomin.encodeFunctionData('getAllActiveToggles'),
    iface: iZoomin,
    fnName: 'getAllActiveToggles',
  };
}

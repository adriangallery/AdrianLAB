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

export function encodeGetAllActiveToggles() {
  return {
    target: CONTRACTS.ZOOMIN_ZEROS,
    callData: iZoomin.encodeFunctionData('getAllActiveToggles'),
    iface: iZoomin,
    fnName: 'getAllActiveToggles',
  };
}

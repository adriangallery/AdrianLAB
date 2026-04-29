// ============================================
// T-Shit URI resolver — reads designURI from the $ZERO Diamond's
// TShitMintFacet for any tokenId minted in the V2 range (30301..35000).
// ============================================
//
// Tokens 30000..30300 are the V1 legacy range — those still resolve via
// the hardcoded adrianzero.com/designs/<id>.svg URL.
// Tokens 30301..35000 are V2 mints, with their off-chain URL stored on-chain
// by TShitMintFacet.mintTShit.
//
// We cache resolved URIs in-process (small TTL) to keep per-render RPC
// pressure manageable. Misses are swallowed: if the on-chain read fails,
// callers fall back to a placeholder fetch and degrade gracefully.

import { ethers } from 'ethers';
import { getProvider } from './provider.js';
import { CONTRACTS } from '../shared/constants.js';

const TSHIT_FIRST_ID = 30301;
const TSHIT_LAST_ID = 35000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — designs are immutable, so this is just memory pressure relief

const TSHIT_FACET_ABI = [
  'function tshitGetDesignURI(uint256 tokenId) view returns (string)',
  'function tshitWasMintedHere(uint256 tokenId) view returns (bool)',
];

const cache = new Map(); // id -> { uri, ts }

export function isTShitV2(tokenId) {
  const id = typeof tokenId === 'number' ? tokenId : parseInt(tokenId, 10);
  return Number.isFinite(id) && id >= TSHIT_FIRST_ID && id <= TSHIT_LAST_ID;
}

export async function resolveTShitUri(tokenId) {
  const id = typeof tokenId === 'number' ? tokenId : parseInt(tokenId, 10);
  if (!isTShitV2(id)) return null;

  const hit = cache.get(id);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.uri;
  }

  try {
    const provider = await getProvider();
    const facet = new ethers.Contract(CONTRACTS.ZERO_DIAMOND, TSHIT_FACET_ABI, provider);
    const uri = await facet.tshitGetDesignURI(id);
    if (!uri || uri.length === 0) return null;
    cache.set(id, { uri, ts: Date.now() });
    return uri;
  } catch (err) {
    console.warn(`[tshit-resolver] Failed to read designURI(${id}):`, err.message);
    return null;
  }
}

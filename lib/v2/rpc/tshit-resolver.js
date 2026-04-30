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

// V2 mints recycle the pre-registered SWAG slots starting at 30014
// (V1 legacy real mints are 30000..30013 only — those keep their GitHub raw
// URLs since their SVG was committed at mint time by the original V1 app).
const TSHIT_FIRST_ID = 30014;
const TSHIT_LAST_ID = 35000;
// Designs are immutable per id (mintTShit can't be re-called for the same
// token), so we can cache for a long time. The 12h TTL is a memory-pressure
// safeguard — Vercel serverless instances cycle long before this anyway.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
// Negative cache for unminted ids: shorter TTL so a fresh mint surfaces fast.
const NEGATIVE_TTL_MS = 60 * 1000;

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
  if (hit) {
    const ttl = hit.uri ? CACHE_TTL_MS : NEGATIVE_TTL_MS;
    if (Date.now() - hit.ts < ttl) return hit.uri;
  }

  try {
    const provider = await getProvider();
    const facet = new ethers.Contract(CONTRACTS.ZERO_DIAMOND, TSHIT_FACET_ABI, provider);
    const uri = await facet.tshitGetDesignURI(id);
    const value = uri && uri.length > 0 ? uri : null;
    cache.set(id, { uri: value, ts: Date.now() });
    return value;
  } catch (err) {
    console.warn(`[tshit-resolver] Failed to read designURI(${id}):`, err.message);
    return null;
  }
}

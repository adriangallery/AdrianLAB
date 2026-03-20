// ============================================
// V2 Cache Keys — Conventions and TTLs
// ============================================

// ===== TTLs (in seconds) =====
export const TTL = {
  RENDER_PNG:       3600,      // 1 hour — rendered token image
  RENDER_GIF:       3600,      // 1 hour — animated GIF
  METADATA_JSON:    600,       // 10 minutes — metadata JSON
  TRAIT_PNG:        604800,    // 7 days — pre-rendered trait PNG
  TOGGLES:          86400,     // 24 hours — toggle state
  TOKEN_DATA:       300,       // 5 minutes — on-chain data
  DUP_INFO:         86400,     // 24 hours — duplication info (immutable once set)
  DUP_INFO_NONE:    3600,      // 1 hour — non-duplicated token (may become dup)
  SAMURAI_INDEX:    60,        // 1 minute — SamuraiZERO list (new mints)
};

// ===== KEY GENERATORS =====

/** Rendered token PNG/GIF */
export function renderKey(tokenId, hash) {
  return `v2:render:${tokenId}:${hash}`;
}

/** Metadata JSON */
export function metadataKey(tokenId) {
  return `v2:meta:${tokenId}`;
}

/** Pre-rendered trait PNG */
export function traitPngKey(category, traitId) {
  return `v2:trait:${category}:${traitId}`;
}

/** Toggle state (all tokens) */
export function togglesKey() {
  return 'v2:toggles:all';
}

/** On-chain token data (Multicall3 result) */
export function tokenDataKey(tokenId) {
  return `v2:data:${tokenId}`;
}

/** SamuraiZERO sorted token list */
export function samuraiListKey() {
  return 'v2:samurai:list';
}

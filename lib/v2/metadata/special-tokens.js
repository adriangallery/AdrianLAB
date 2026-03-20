// ============================================
// V2 Special Tokens — Hardcoded overrides
// ============================================

import { SPECIAL_TOKENS, BASE_URL } from '../shared/constants.js';

/**
 * Check if a token has special hardcoded metadata.
 * Returns the full metadata object if so, or null if normal processing should continue.
 *
 * @param {number} tokenId
 * @returns {Object|null} - Full metadata response or null
 */
export function getSpecialTokenMetadata(tokenId) {
  const special = SPECIAL_TOKENS[tokenId];
  if (!special) return null;

  return {
    name: special.name
      ? `${special.name} #${tokenId}`
      : `AdrianZero #${tokenId}`,
    description: `AdrianZERO — Evolving PFP NFT on Base`,
    image: `${BASE_URL}${special.image}`,
    external_url: `https://adrianzero.com/token/${tokenId}`,
    metadata_version: '2',
    attributes: [
      { trait_type: 'Special', value: special.name || 'Special Edition' },
    ],
  };
}

/**
 * Check if tokenId 100000 (static metadata)
 */
export function isStaticMetadataToken(tokenId) {
  return tokenId === 100000;
}

/**
 * Check if token is an Action Pack (15008-15010)
 */
export function isActionPack(tokenId) {
  return tokenId >= 15008 && tokenId <= 15010;
}

/**
 * Check if token 682 needs animation_url
 */
export function getAnimationUrl(tokenId) {
  if (tokenId === 682) return 'https://adrianzero.com/mcinteractive/';
  return null;
}

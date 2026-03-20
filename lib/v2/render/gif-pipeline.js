// ============================================
// V2 GIF Pipeline — Animated traits + bounce
// ============================================
// Delegates to V1 gif-generator for now, as the GIF logic
// is complex and self-contained. V2 just wraps it with the
// new data fetching flow.

import { generateGifFromLayers } from '../../gif-generator.js';
import { getAnimatedTraits } from '../../animated-traits-helper.js';

/**
 * Check if a token has animated traits
 * @param {string[]} traitIds - All equipped trait IDs
 * @returns {Promise<Array<{baseId: string, variants: string[]}>>}
 */
export async function detectAnimatedTraits(traitIds) {
  const validIds = traitIds.filter(id => id && id !== 'None' && id !== '');
  return getAnimatedTraits(validIds);
}

/**
 * Generate a GIF for a token with animated traits.
 * Uses V1 gif-generator internally.
 *
 * @param {Object} tokenData - From fetchAllTokenData
 * @param {Object} equippedTraits - Normalized traits
 * @param {Object} options - Render options
 * @returns {Promise<Buffer|null>} - GIF buffer or null if no animated traits
 */
export async function generateTokenGif(tokenData, equippedTraits, options = {}) {
  const traitIds = Object.values(equippedTraits).filter(id => id && id !== 'None' && id !== '');
  const animatedTraits = await detectAnimatedTraits(traitIds);

  if (animatedTraits.length === 0) return null;

  try {
    // Delegate to V1 gif-generator
    // This function handles all frame generation internally
    const gifBuffer = await generateGifFromLayers({
      tokenId: tokenData.tokenId,
      equippedTraits,
      animatedTraits,
      generation: tokenData.generation,
      skinId: tokenData.effectiveSkinId,
      skinName: tokenData.effectiveSkinName,
      dupInfo: tokenData.dupInfo,
      tagInfo: tokenData.tagInfo,
    });

    return gifBuffer;
  } catch (err) {
    console.error(`[gif-pipeline] Error generating GIF for token ${tokenData.tokenId}:`, err.message);
    return null;
  }
}

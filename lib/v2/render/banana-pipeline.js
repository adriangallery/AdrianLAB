// ============================================
// V2 Banana Pipeline — NanoBanana AI transform
// ============================================
// Wraps V1 nanobanana-transformer. Only applies when toggle 13 is active.

import { transformWithNanoBanana } from '../../nanobanana-transformer.js';
import { buildNanobananaPrompt } from '../../nanobanana-prompt.js';

/**
 * Apply NanoBanana AI transform to a rendered PNG buffer.
 * Uses Gemini 2.5 Flash via Vercel AI SDK.
 *
 * @param {Buffer} pngBuffer - Source PNG image
 * @param {number} tokenId - Token ID (for prompt context)
 * @returns {Promise<Buffer|null>} - Transformed PNG or null on failure
 */
export async function applyBananaTransform(pngBuffer, tokenId) {
  try {
    const prompt = buildNanobananaPrompt(tokenId);
    const result = await transformWithNanoBanana(pngBuffer, prompt);
    return result;
  } catch (err) {
    console.error(`[banana-pipeline] Transform failed for token ${tokenId}:`, err.message);
    return null;
  }
}

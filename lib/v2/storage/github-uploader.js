// ============================================
// V2 GitHub Uploader — Async fire-and-forget
// ============================================
// Wraps V1 github-storage for upload and check.
// Upload is fire-and-forget (don't block the response).

import {
  fileExistsInGitHub,
  fileExistsInGitHubByHash,
  getGitHubFileUrl,
  getGitHubFileUrlByHash,
  uploadFileToGitHubByHash,
} from '../../github-storage.js';

/**
 * Check if a render exists in GitHub CDN by hash.
 * For banana renders, also checks the legacy fixed-name file ({tokenId}_banana.png)
 * before falling through to a full re-render.
 *
 * @param {string|number} tokenId
 * @param {string} renderHash - 16-char hex hash
 * @param {{ isBanana?: boolean }} opts
 * @returns {Promise<{exists: boolean, url: string|null}>}
 */
export async function checkGitHub(tokenId, renderHash, opts = {}) {
  // 1. Check by hash (current system)
  try {
    const exists = await fileExistsInGitHubByHash(tokenId, renderHash);
    if (exists) {
      const url = getGitHubFileUrlByHash(tokenId, renderHash);
      return { exists: true, url };
    }
  } catch (err) {
    console.warn(`[github-uploader] Hash check failed for ${tokenId}/${renderHash}:`, err.message);
  }

  // 2. Banana fallback: check legacy fixed-name file ({tokenId}_banana.png)
  //    These were uploaded before the hash system existed and are the "original" renders.
  if (opts.isBanana) {
    try {
      const legacyExists = await fileExistsInGitHub(tokenId, 'banana');
      if (legacyExists) {
        const url = getGitHubFileUrl(tokenId, 'banana');
        console.log(`[github-uploader] ✅ Found legacy banana for ${tokenId}`);
        return { exists: true, url };
      }
    } catch (err) {
      console.warn(`[github-uploader] Legacy banana check failed for ${tokenId}:`, err.message);
    }
  }

  return { exists: false, url: null };
}

/**
 * Download a render from GitHub CDN.
 * @param {string} url - Full GitHub raw URL
 * @returns {Promise<Buffer|null>}
 */
export async function downloadFromGitHub(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch (err) {
    console.warn(`[github-uploader] Download failed:`, err.message);
    return null;
  }
}

/**
 * Upload a render to GitHub CDN (fire-and-forget).
 * Returns immediately — upload happens in background.
 * WARNING: On Vercel serverless, container may die before upload completes.
 * Use uploadToGitHubSync() for renders that MUST persist (e.g. banana).
 *
 * @param {string|number} tokenId
 * @param {string} renderHash
 * @param {Buffer} pngBuffer
 */
export function uploadToGitHubAsync(tokenId, renderHash, pngBuffer) {
  uploadFileToGitHubByHash(tokenId, renderHash, pngBuffer).catch(err => {
    console.warn(`[github-uploader] Upload failed for ${tokenId}/${renderHash}:`, err.message);
  });
}

/**
 * Upload a render to GitHub CDN (blocking).
 * Awaits the upload to ensure it persists before response is sent.
 * Use for expensive renders (banana, etc.) that should survive cold starts.
 *
 * @param {string|number} tokenId
 * @param {string} renderHash
 * @param {Buffer} pngBuffer
 */
export async function uploadToGitHubSync(tokenId, renderHash, pngBuffer) {
  try {
    await uploadFileToGitHubByHash(tokenId, renderHash, pngBuffer);
  } catch (err) {
    console.warn(`[github-uploader] Sync upload failed for ${tokenId}/${renderHash}:`, err.message);
  }
}

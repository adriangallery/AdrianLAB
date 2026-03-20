// ============================================
// V2 Metadata Cache — ETag support
// ============================================

import crypto from 'crypto';
import { kvGet, kvSet } from './kv-client.js';
import { metadataKey, TTL } from './cache-keys.js';

/**
 * Compute an ETag from a metadata JSON object
 * @param {Object} metadata
 * @returns {string} - ETag value (quoted)
 */
export function computeETag(metadata) {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(metadata))
    .digest('hex')
    .substring(0, 16);
  return `"${hash}"`;
}

/**
 * Get cached metadata for a token.
 * @param {number|string} tokenId
 * @returns {Promise<{metadata: Object, etag: string}|null>}
 */
export async function getCachedMetadata(tokenId) {
  const key = metadataKey(tokenId);
  const cached = await kvGet(key);
  if (!cached) return null;
  return cached; // { metadata, etag }
}

/**
 * Cache metadata for a token with ETag.
 * @param {number|string} tokenId
 * @param {Object} metadata
 */
export async function setCachedMetadata(tokenId, metadata) {
  const key = metadataKey(tokenId);
  const etag = computeETag(metadata);
  await kvSet(key, { metadata, etag }, TTL.METADATA_JSON);
}

/**
 * Check If-None-Match and return 304 if ETag matches.
 * @param {Object} req - Next.js request
 * @param {string} etag - Current ETag
 * @returns {boolean} - true if client has current version
 */
export function checkConditional(req, etag) {
  const ifNoneMatch = req.headers['if-none-match'];
  return ifNoneMatch === etag;
}

// ============================================
// V2 Metadata Endpoint — /api/v2/metadata/[tokenId]
// ============================================
// Thin orchestrator (~100 lines). All logic lives in lib/v2/.
//
// Flow: Parse → Special check → KV check (ETag) → Multicall3 → Build → Cache → Return
//
// Performance targets:
//   304 Not Modified: ~3ms
//   Cache HIT:        ~5ms (KV)
//   Full miss:        80-150ms (1 RPC + build)

import { applyCors } from '../../../../lib/v2/shared/cors.js';
import { fetchAllTokenData } from '../../../../lib/v2/rpc/token-data-fetcher.js';
import { buildMetadata } from '../../../../lib/v2/metadata/builder.js';
import { getSpecialTokenMetadata, isStaticMetadataToken, isActionPack } from '../../../../lib/v2/metadata/special-tokens.js';
import { getTokenToggleEffects, refreshToggles } from '../../../../lib/v2/cache/toggle-store.js';
import {
  getCachedMetadata,
  setCachedMetadata,
  computeETag,
  checkConditional,
} from '../../../../lib/v2/cache/metadata-cache.js';
import { getSamuraiIndex } from '../../../../lib/v2/tags/tag-resolver.js';
import { TTL } from '../../../../lib/v2/cache/cache-keys.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const start = Date.now();

  try {
    // === Parse tokenId ===
    let rawId = req.query.tokenId;
    if (rawId) rawId = rawId.replace(/\.json$/i, '');
    const tokenId = parseInt(rawId);
    if (isNaN(tokenId) || tokenId < 0) {
      return res.status(400).json({ error: 'Invalid tokenId' });
    }

    // === Special tokens (O(1) lookup, no RPC needed) ===
    const special = getSpecialTokenMetadata(tokenId);
    if (special) return sendJson(res, special, start);

    // === Static metadata token (100000) ===
    if (isStaticMetadataToken(tokenId)) {
      try {
        const staticPath = path.join(process.cwd(), 'public', 'metadata', '100000.json');
        const staticData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
        return sendJson(res, staticData, start);
      } catch (err) {
        return res.status(404).json({ error: 'Static metadata not found' });
      }
    }

    // === KV cache check with ETag ===
    const cached = await getCachedMetadata(tokenId);
    if (cached) {
      const { metadata, etag } = cached;

      // 304 Not Modified
      if (checkConditional(req, etag)) {
        res.setHeader('ETag', etag);
        return res.status(304).end();
      }

      return sendJson(res, metadata, start, etag, 'HIT');
    }

    // === Refresh toggles (lazy, runs if stale) ===
    await refreshToggles();

    // === Fetch all on-chain data (1 Multicall3 RPC) ===
    const tokenData = await fetchAllTokenData(tokenId, { includeMetadata: true });

    // === Get toggle effects ===
    const toggleEffects = await getTokenToggleEffects(tokenId);

    // === SamuraiZERO index ===
    if (tokenData.tagInfo?.tag === 'SamuraiZERO') {
      tokenData._samuraiIndex = await getSamuraiIndex(tokenId);
    }

    // === ZEROmovies: movieId already fetched in tokenData ===

    // === Build metadata ===
    const metadata = await buildMetadata(tokenData, toggleEffects);

    // === Cache ===
    await setCachedMetadata(tokenId, metadata);
    const etag = computeETag(metadata);

    return sendJson(res, metadata, start, etag, 'MISS');

  } catch (err) {
    console.error(`[v2/metadata] Error:`, err);
    return res.status(200).json({
      name: `ZERO #${req.query.tokenId || '?'}`,
      description: 'ZERO — Evolving PFP NFT on Base',
      image: '',
      metadata_version: '2-error',
      error: err.message,
    });
  }
}

function sendJson(res, metadata, start, etag = null, cacheStatus = null) {
  const elapsed = Date.now() - start;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', `public, max-age=${TTL.METADATA_JSON}, s-maxage=${TTL.METADATA_JSON}, stale-while-revalidate=60`);
  if (etag) res.setHeader('ETag', etag);
  if (cacheStatus) res.setHeader('X-Cache', cacheStatus);
  res.setHeader('X-Response-Time', `${elapsed}ms`);
  res.setHeader('X-Version', 'ADRIANZERO-METADATA-V2');
  return res.status(200).json(metadata);
}

// ============================================
// V2 Render Endpoint — /api/v2/render/[tokenId]
// ============================================
// Thin orchestrator (~150 lines). All logic lives in lib/v2/.
//
// Flow: Parse → KV check → GitHub check → Multicall3 → Compose → Cache → Return
//
// Performance targets:
//   Cache HIT:  5-15ms (KV)
//   GitHub HIT: ~50ms
//   Full miss:  200-400ms (1 RPC + PNGs + compose)

import fs from 'fs';
import path from 'path';
import { applyCors } from '../../../../lib/v2/shared/cors.js';
import { SPECIAL_TOKENS } from '../../../../lib/v2/shared/constants.js';
import { fetchAllTokenData } from '../../../../lib/v2/rpc/token-data-fetcher.js';
import { compositeToken } from '../../../../lib/v2/render/compositor.js';
import { generateRenderHash, getRenderFilename } from '../../../../lib/v2/shared/render-hash.js';
import { kvGetBuffer, kvSetBuffer } from '../../../../lib/v2/cache/kv-client.js';
import { renderKey, TTL } from '../../../../lib/v2/cache/cache-keys.js';
import { checkGitHub, downloadFromGitHub, uploadToGitHubAsync, uploadToGitHubSync } from '../../../../lib/v2/storage/github-uploader.js';
import { getTokenToggleEffects } from '../../../../lib/v2/cache/toggle-store.js';
import { normalizeTraits } from '../../../../lib/v2/render/layer-order.js';
import { applyBananaTransform } from '../../../../lib/v2/render/banana-pipeline.js';
import { getSamuraiIndex } from '../../../../lib/v2/tags/tag-resolver.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const start = Date.now();

  try {
    // === Parse tokenId ===
    let rawId = req.query.tokenId;
    if (rawId) rawId = rawId.replace(/\.(png|gif)$/i, '');
    const tokenId = parseInt(rawId);
    if (isNaN(tokenId) || tokenId < 0) {
      return res.status(400).json({ error: 'Invalid tokenId' });
    }

    // === Special 1/1 tokens (serve static GIF) ===
    const special = SPECIAL_TOKENS[tokenId];
    if (special) {
      const gifPath = path.join(process.cwd(), 'public', special.image);
      try {
        const gifBuffer = fs.readFileSync(gifPath);
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('X-Version', 'ADRIANZERO-V2-SPECIAL');
        return res.status(200).send(gifBuffer);
      } catch (e) {
        // GIF not found, fall through to normal render
      }
    }

    // === Parse query params ===
    const qBool = (k) => req.query[k] === 'true' || req.query[k] === '1';
    let isCloseup = qBool('closeup');
    let isShadow = qBool('shadow');
    let isGlow = qBool('glow');
    let isBn = qBool('bn') || qBool('bw');
    let isUv = qBool('uv');
    let isBlackout = qBool('blackout');
    let isBanana = qBool('banana');
    const messageText = req.query.messages || null;
    const useAdrianFont = req.query.AZ === 'true' || req.query.az === 'true' || req.query.font === 'AZ';

    // === Apply toggle effects ===
    const toggleEffects = await getTokenToggleEffects(tokenId);
    if (toggleEffects.closeup) isCloseup = true;
    if (toggleEffects.shadow) isShadow = true;
    if (toggleEffects.glow) isGlow = true;
    if (toggleEffects.bn) isBn = true;
    if (toggleEffects.uv) isUv = true;
    if (toggleEffects.blackout) isBlackout = true;
    if (toggleEffects.banana) isBanana = true;

    // Banana is incompatible with messages
    if (messageText) isBanana = false;

    // === Fetch all on-chain data (1 Multicall3 RPC) ===
    const tokenData = await fetchAllTokenData(tokenId);

    // === SamuraiZERO index ===
    if (tokenData.tagInfo?.tag === 'SamuraiZERO') {
      tokenData._samuraiIndex = await getSamuraiIndex(tokenId);
    }

    // === ZEROmovies: movieId already fetched in tokenData ===

    // === Build render hash ===
    const equippedTraits = normalizeTraits(tokenData.categories, tokenData.traitIds);
    const finalCategories = Object.keys(equippedTraits).filter(c => c !== 'SKINTRAIT').sort();
    const finalTraitIds = finalCategories.map(c => equippedTraits[c]);

    const hash = generateRenderHash({
      closeup: isCloseup, shadow: isShadow, glow: isGlow, bn: isBn,
      uv: isUv, blackout: isBlackout, banana: isBanana && !messageText,
      messages: messageText,
      generation: String(tokenData.originalGeneration),
      mutationLevel: String(tokenData.mutationLevel),
      canReplicate: tokenData.canReplicate,
      hasBeenModified: tokenData.hasBeenModified,
      skinId: String(tokenData.skinId), skinName: tokenData.skinName,
      traitCategories: finalCategories, traitIds: finalTraitIds,
      appliedSerum: tokenData.appliedSerum, serumFailed: tokenData.serumFailed,
      failedSerumType: tokenData.failedSerumType, hasAdrianGFSerum: tokenData.hasAdrianGFSerum,
      serumHistory: tokenData.serumHistory,
      skintraitId: equippedTraits['SKINTRAIT'] || null,
      tag: tokenData.tagInfo?.tag, tagIndex: tokenData._samuraiIndex ?? null, movieId: tokenData.movieId ?? null,
      duplicated: tokenData.dupInfo?.duplicated || false,
      dupNumber: tokenData.dupInfo?.dupNumber || 0,
    });

    const kvCacheKey = renderKey(tokenId, hash);

    // === 1. KV cache check ===
    const kvBuffer = await kvGetBuffer(kvCacheKey);
    if (kvBuffer) {
      return sendPng(res, kvBuffer, 'HIT', hash, tokenId, start);
    }

    // === 2. GitHub CDN check (includes legacy banana fallback) ===
    const gh = await checkGitHub(tokenId, hash, { isBanana });
    if (gh.exists && gh.url) {
      const ghBuffer = await downloadFromGitHub(gh.url);
      if (ghBuffer) {
        // Persist to KV for next time
        kvSetBuffer(kvCacheKey, ghBuffer, TTL.RENDER_PNG).catch(() => {});
        return sendPng(res, ghBuffer, 'GITHUB', hash, tokenId, start);
      }
    }

    // === 3. Render ===
    const { buffer } = await compositeToken(tokenData, {
      closeup: isCloseup, shadow: isShadow, glow: isGlow,
      bn: isBn, uv: isUv, blackout: isBlackout,
      messageText, useAdrianFont,
    });

    let finalBuffer = buffer;

    // === 4. Banana transform (if active) ===
    if (isBanana) {
      const bananaBuffer = await applyBananaTransform(buffer, tokenId);
      if (bananaBuffer) finalBuffer = bananaBuffer;
    }

    // === 5. Cache + upload ===
    kvSetBuffer(kvCacheKey, finalBuffer, TTL.RENDER_PNG).catch(() => {});

    if (isBanana) {
      // Banana renders are expensive (Gemini API call) — await upload to ensure
      // they persist to GitHub before Vercel kills the container
      await uploadToGitHubSync(tokenId, hash, finalBuffer);
    } else {
      // Normal renders are cheap to regenerate — fire-and-forget is fine
      uploadToGitHubAsync(tokenId, hash, finalBuffer);
    }

    return sendPng(res, finalBuffer, 'MISS', hash, tokenId, start);

  } catch (err) {
    console.error(`[v2/render] Error:`, err);
    return res.status(500).json({ error: 'Render failed', message: err.message });
  }
}

function sendPng(res, buffer, cacheStatus, hash, tokenId, start) {
  const elapsed = Date.now() - start;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', `public, max-age=${TTL.RENDER_PNG}`);
  res.setHeader('X-Cache', cacheStatus);
  res.setHeader('X-Render-Hash', hash);
  res.setHeader('X-Render-Time', `${elapsed}ms`);
  res.setHeader('X-Version', 'ADRIANZERO-V2');
  return res.status(200).send(buffer);
}

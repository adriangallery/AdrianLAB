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
import { isTShitV2, resolveTShitUri } from '../../../../lib/v2/rpc/tshit-resolver.js';
import { rasteriseStudioSvg } from '../../../../lib/v2/render/studio-rasterizer.js';
import { fetchAllTokenData } from '../../../../lib/v2/rpc/token-data-fetcher.js';
import { compositeToken } from '../../../../lib/v2/render/compositor.js';
import { generateRenderHash, getRenderFilename } from '../../../../lib/v2/shared/render-hash.js';
import { kvGetBuffer, kvSetBuffer } from '../../../../lib/v2/cache/kv-client.js';
import { renderKey, renderGifKey, TTL } from '../../../../lib/v2/cache/cache-keys.js';
import { checkGitHub, downloadFromGitHub, uploadToGitHubAsync, uploadToGitHubSync } from '../../../../lib/v2/storage/github-uploader.js';
import { getTokenToggleEffects } from '../../../../lib/v2/cache/toggle-store.js';
import { normalizeTraits } from '../../../../lib/v2/render/layer-order.js';
import { applyBananaTransform } from '../../../../lib/v2/render/banana-pipeline.js';
import { getSamuraiIndex, getGumballIndex } from '../../../../lib/v2/tags/tag-resolver.js';
import { detectAnimatedTraits } from '../../../../lib/v2/render/gif-pipeline.js';
import {
  generateGifFromLayers,
  createBounceOnlyFrameGenerator,
  createBounceSquashFrameGenerator,
} from '../../../../lib/gif-generator.js';

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

    // === Studio T-Shit standalone fast-path (30014..35000) ===
    // User-minted 1/1 designs whose SVG lives on-chain via tshitGetDesignURI.
    // When the renderer is asked for the trait by itself (e.g. the inventory
    // thumbnail), we skip the AdrianZero composition flow and return the
    // rasterised on-chain SVG directly.
    if (isTShitV2(tokenId)) {
      try {
        const designUri = await resolveTShitUri(tokenId);
        if (designUri) {
          const designResp = await fetch(designUri, { signal: AbortSignal.timeout(5000) });
          if (designResp.ok) {
            const svgBuf = Buffer.from(await designResp.arrayBuffer());
            const pngBuffer = await rasteriseStudioSvg(svgBuf);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', `public, max-age=${TTL.RENDER_PNG}`);
            res.setHeader('X-Render-Type', 'studio-tshit');
            res.setHeader('X-Version', 'ADRIANZERO-V2-STUDIO');
            res.setHeader('X-Render-Time', `${Date.now() - start}ms`);
            return res.status(200).send(pngBuffer);
          }
          console.warn(`[v2/render] Studio ${tokenId}: designUri fetch ${designResp.status}`);
        } else {
          console.warn(`[v2/render] Studio ${tokenId}: no on-chain designUri`);
        }
      } catch (err) {
        console.error(`[v2/render] Studio ${tokenId} fast-path error:`, err.message);
      }
      // Fall through to generic flow if anything failed (renders blank tshirt
      // template rather than 500 — same behavior as before this fast-path).
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

    // === Bounce on-demand (GIF output) ===
    const isBounce = qBool('bounce');
    const bounceConfig = isBounce ? {
      enabled: true,
      direction: req.query.bounceDir || 'y',
      distance: parseFloat(req.query.bounceDist) || 30,
      bounces: parseInt(req.query.bounceCount) || 2,
      frames: parseInt(req.query.bounceFrames) || 12,
      delay: parseInt(req.query.bounceDelay) || 1,
      squash: req.query.squash !== undefined ? parseFloat(req.query.squash) : 0.12,
      stretch: req.query.stretch !== undefined ? parseFloat(req.query.stretch) : 0.06,
      anchorY: req.query.anchorY !== undefined ? parseFloat(req.query.anchorY) : 0.92,
      frameMs: parseInt(req.query.bounceFrameMs) || 80,
      perCategoryDelay: req.query.bouncePerCategory !== 'false',
    } : null;

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

    // === GumballZERO index ===
    // Ordinal position in sorted ascending list of all GumballZERO tokenIds.
    // Maps to collection[index] in gums.json — same pattern as _samuraiIndex.
    if (tokenData.tagInfo?.tag === 'GumballZERO') {
      tokenData._gumballIndex = await getGumballIndex(tokenId);
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
      tag: tokenData.tagInfo?.tag, tagIndex: tokenData._samuraiIndex ?? null, gumballIndex: tokenData._gumballIndex ?? null, movieId: tokenData.movieId ?? null,
      overdueState: buildOverdueState(tokenData.movieRental),
      duplicated: tokenData.dupInfo?.duplicated || false,
      dupNumber: tokenData.dupInfo?.dupNumber || 0,
      bounce: bounceConfig,
    });

    // Detectar traits animados secuenciales (1165a/1165b/...). El compositor
    // los excluye del PNG base; el GIF generator los reinyecta frame a frame.
    // Closeup no soporta GIF, así que skipeamos la detección.
    let animatedTraits = [];
    let animatedTraitIdsSet = new Set();
    if (!isCloseup) {
      const allEquippedIds = Object.values(equippedTraits).filter(id => id && id !== 'None' && id !== '');
      animatedTraits = await detectAnimatedTraits(allEquippedIds);
      animatedTraitIdsSet = new Set(animatedTraits.map(at => String(at.baseId)));
    }
    const shouldEmitGif = !isCloseup && (animatedTraits.length > 0 || isBounce);

    const kvCacheKey = renderKey(tokenId, hash);
    const kvGifKey = renderGifKey(tokenId, hash);

    // === 1. KV cache check ===
    if (shouldEmitGif) {
      const kvGifBuffer = await kvGetBuffer(kvGifKey);
      if (kvGifBuffer) {
        return sendGif(res, kvGifBuffer, 'HIT', hash, tokenId, start, isBounce);
      }
    } else {
      const kvBuffer = await kvGetBuffer(kvCacheKey);
      if (kvBuffer) {
        return sendPng(res, kvBuffer, 'HIT', hash, tokenId, start);
      }

      // === 2. GitHub CDN check (PNG only — banana etc) ===
      const gh = await checkGitHub(tokenId, hash, { isBanana });
      if (gh.exists && gh.url) {
        const ghBuffer = await downloadFromGitHub(gh.url);
        if (ghBuffer) {
          kvSetBuffer(kvCacheKey, ghBuffer, TTL.RENDER_PNG).catch(() => {});
          return sendPng(res, ghBuffer, 'GITHUB', hash, tokenId, start);
        }
      }
    }

    // === 3. Render PNG base ===
    // Si la salida final es un GIF, dile al compositor que omita los traits
    // animados (los re-añadirá el GIF generator frame a frame). Para bounce
    // pedimos también el split del background así el bg queda fijo en el GIF.
    const composite = await compositeToken(tokenData, {
      closeup: isCloseup, shadow: isShadow, glow: isGlow,
      bn: isBn, uv: isUv, blackout: isBlackout,
      messageText, useAdrianFont,
      animatedTraitIds: animatedTraitIdsSet,
      splitBackground: isBounce && !isCloseup,
    });
    const { buffer, backgroundBuffer, characterBuffer } = composite;

    let finalBuffer = buffer;

    // === 4. Banana transform (if active) ===
    if (isBanana && !shouldEmitGif) {
      // Banana es incompatible con GIF (transforma raster vía Gemini)
      const bananaBuffer = await applyBananaTransform(buffer, tokenId);
      if (bananaBuffer) finalBuffer = bananaBuffer;
    }

    // === 4.5. GIF branch ===
    if (shouldEmitGif) {
      try {
        const frameMs = bounceConfig?.frameMs || 80;
        let customGen;

        if (isBounce) {
          // Capa 0 estática: background (no rebota).
          // Capa 1+ con bounce: el personaje (sin bg) y, si los hay, traits animados.
          const bounceLayers = [];
          if (backgroundBuffer) {
            bounceLayers.push({ pngBuffer: backgroundBuffer, isStatic: true, category: 'BACKGROUND' });
          }
          if (characterBuffer) {
            bounceLayers.push({ pngBuffer: characterBuffer, category: 'BODY' });
          } else {
            // Fallback: si por alguna razón no tenemos split, todo el buffer rebota
            bounceLayers.push({ pngBuffer: finalBuffer, category: 'BODY' });
          }

          customGen = createBounceSquashFrameGenerator({
            layers: bounceLayers,
            animatedTraits,
            bounceConfig,
            width: 1000,
            height: 1000,
            delay: frameMs,
          });
        }

        const gifBuffer = isBounce
          ? await generateGifFromLayers({
              stableLayers: [],
              animatedTraits: [],
              width: 1000, height: 1000,
              delay: frameMs,
              customFrameGenerator: customGen,
              totalFrames: bounceConfig.frames,
            })
          : await generateGifFromLayers({
              stableLayers: [{ pngBuffer: finalBuffer }],
              animatedTraits,
              width: 1000, height: 1000,
              delay: 500,
            });

        kvSetBuffer(kvGifKey, gifBuffer, TTL.RENDER_GIF).catch(() => {});
        return sendGif(res, gifBuffer, 'MISS', hash, tokenId, start, isBounce);
      } catch (err) {
        console.error(`[v2/render] GIF generation failed for ${tokenId}:`, err.message);
        console.error(err.stack);
        // Caemos a PNG estático abajo
      }
    }

    // === 5. Cache + upload (PNG path) ===
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

// Discretize rental state into a cache-key-friendly string.
// Buckets daysOverdue at 0/1/3/7/14/30/60+ so renders aren't regenerated daily
// for tapes that have been overdue for months — only on meaningful transitions.
//
// Prefix `od2-` (bumped from `od-`) busts the v1 cached PNGs that were stored
// before the OVERDUE stamp text was rasterized via Canvas. Bump again if the
// overlay artwork or text rendering changes in a visible way.
function buildOverdueState(movieRental) {
  if (!movieRental) return '';
  if (movieRental.permanent) return 'perm';
  if (!movieRental.isOverdue) return 'active';
  const d = movieRental.daysOverdue || 0;
  let bucket;
  if (d < 1) bucket = '0';
  else if (d < 3) bucket = '1';
  else if (d < 7) bucket = '3';
  else if (d < 14) bucket = '7';
  else if (d < 30) bucket = '14';
  else if (d < 60) bucket = '30';
  else bucket = '60';
  return `od2-${bucket}`;
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

function sendGif(res, buffer, cacheStatus, hash, tokenId, start, isBounce) {
  const elapsed = Date.now() - start;
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', `public, max-age=${TTL.RENDER_GIF}`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('X-Cache', cacheStatus);
  res.setHeader('X-Render-Hash', hash);
  res.setHeader('X-Render-Time', `${elapsed}ms`);
  const versionParts = ['ADRIANZERO-V2-ANIMATED'];
  if (isBounce) {
    versionParts.push('BOUNCE');
    res.setHeader('X-Bounce', 'enabled');
  }
  res.setHeader('X-Version', versionParts.join('-'));
  return res.status(200).send(buffer);
}

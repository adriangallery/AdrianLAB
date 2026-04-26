// ============================================
// V2 Compositor — ONE function to render any token
// ============================================
// Replaces render/[tokenId].js (2547 lines), rendershadow/[tokenId].js (1276 lines),
// and the custom render logic. Uses pre-rendered PNGs instead of runtime Resvg.

import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import { resolveSkin, resolveSkinTraitOverlay } from './skin-resolver.js';
import { normalizeTraits, getLayerSequence, getTraitLoadPath } from './layer-order.js';
import { loadTraitImage, loadTraitFromLabimages } from './trait-loader.js';
import {
  applyShadow, applyBlackout, applyGlow, applyCloseup,
  applyBN, applyUV, applyMessages, applyParentText,
} from './effects.js';
import { TAG_CONFIGS } from '../shared/constants.js';

// Register the retro font on module load
try {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'retro', 'PressStart2P-Regular.ttf');
  registerFont(fontPath, { family: 'PressStart2P' });
} catch (e) { /* may fail in edge runtime, OK */ }

try {
  const azFontPath = path.join(process.cwd(), 'public', 'fonts', 'ADRIAN_ZERO.otf');
  registerFont(azFontPath, { family: 'AdrianZERO' });
} catch (e) { /* may fail */ }

/**
 * Composite a full token image from on-chain data.
 *
 * @param {Object} tokenData - Output of fetchAllTokenData()
 * @param {Object} options
 * @param {boolean} options.closeup
 * @param {boolean} options.shadow
 * @param {boolean} options.glow
 * @param {boolean} options.bn
 * @param {boolean} options.uv
 * @param {boolean} options.blackout
 * @param {string|null} options.messageText
 * @param {boolean} options.useAdrianFont
 * @returns {Promise<{buffer: Buffer, contentType: string, isGif: boolean}>}
 */
export async function compositeToken(tokenData, options = {}) {
  const {
    closeup = false,
    shadow = false,
    glow = false,
    bn = false,
    uv = false,
    blackout = false,
    messageText = null,
    useAdrianFont = false,
    animatedTraitIds = new Set(),
  } = options;

  const {
    generation,
    dupInfo,
    tagInfo,
    categories,
    traitIds,
  } = tokenData;

  // === Build equipped traits ===
  let equippedTraits = normalizeTraits(categories, traitIds);

  // === Apply tag logic ===
  equippedTraits = applyTagLogic(equippedTraits, tagInfo, tokenData.tokenId);

  // === SamuraiZERO TOP layer ===
  let samuraiIndex = null;
  if (tagInfo.tag === 'SamuraiZERO') {
    samuraiIndex = tokenData._samuraiIndex ?? null;
    if (samuraiIndex !== null && samuraiIndex >= 0 && samuraiIndex < 600) {
      const imageIndex = TAG_CONFIGS.SamuraiZERO.imageBaseIndex + samuraiIndex;
      equippedTraits['TOP'] = String(imageIndex);
    }
  }

  // === ZEROmovies: flag for post-trait overlay ===
  const isZEROmovie = tagInfo.tag === 'ZEROmovies' && tokenData.movieId;

  // === Canvas setup ===
  const canvasWidth = messageText ? 3000 : 1000;
  const canvasHeight = 1000;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Content canvas (without background) for shadow/glow/blackout
  const needsContentCanvas = shadow || glow || blackout;
  const contentCanvas = needsContentCanvas ? createCanvas(1000, 1000) : null;

  const getDrawCtx = () => {
    return needsContentCanvas ? contentCanvas.getContext('2d') : ctx;
  };

  // === Step 1: Background ===
  if (equippedTraits['BACKGROUND']) {
    const bgImg = await loadTraitFromLabimages(equippedTraits['BACKGROUND']);
    if (bgImg) ctx.drawImage(bgImg, 0, 0, 1000, 1000);
  }

  // Duplicated tokens: pink background
  if (dupInfo.duplicated) {
    ctx.fillStyle = '#FF3388';
    // Only fill if no background trait
    if (!equippedTraits['BACKGROUND']) {
      ctx.fillRect(0, 0, 1000, 1000);
    }
  }

  // === Step 2: Skin/Body ===
  const skinImages = await resolveSkin(tokenData, equippedTraits);
  const drawCtx = getDrawCtx();

  for (const { image } of skinImages) {
    drawCtx.drawImage(image, 0, 0, 1000, 1000);
  }

  // === Step 2.5: Skin trait overlay (SWAG 37/38) ===
  const skinOverlay = await resolveSkinTraitOverlay(equippedTraits, generation);
  if (skinOverlay) {
    drawCtx.drawImage(skinOverlay, 0, 0, 1000, 1000);
  }

  // === Step 3: Traits in order ===
  const layers = getLayerSequence(equippedTraits, animatedTraitIds);

  for (const layer of layers) {
    const { category, traitId } = layer;
    const { subdir, customPath } = getTraitLoadPath(category, traitId, tagInfo);

    const img = await loadTraitImage(category, traitId, { subdir, customPath });
    if (img) {
      drawCtx.drawImage(img, 0, 0, 1000, 1000);
    }
  }

  // === Step 3.5: ZEROmovies overlay (after traits, before effects) ===
  if (isZEROmovie) {
    const movieImg = await loadTraitFromLabimages(`zeromovies/${tokenData.movieId}`);
    if (movieImg) {
      drawCtx.drawImage(movieImg, 0, 0, 1000, 1000);
    }

    // OVERDUE: rent passed gracePeriod and renter hasn't paid the late fee.
    // Apply VHS overlay + draw "OVERDUE" stamp text + day counter on top.
    // Text is drawn via Canvas (not SVG) because Resvg in the Vercel runtime
    // doesn't have Impact/Arial Black available, so any <text> in the overlay
    // SVG would render as an empty box.
    if (tokenData.movieRental?.isOverdue) {
      const overdueImg = await loadTraitFromLabimages('zeromovies/_overlays/overdue');
      if (overdueImg) {
        drawCtx.drawImage(overdueImg, 0, 0, 1000, 1000);
        drawOverdueStamp(drawCtx);
        drawOverdueDayCounter(drawCtx, tokenData.movieRental.daysOverdue || 0);
      }
    }
  }

  // === Step 4: Effects ===

  // Shadow (only if NOT glow)
  if (shadow && !glow && contentCanvas) {
    applyShadow(canvas, contentCanvas);
  }
  // Blackout (only if NOT shadow and NOT glow)
  else if (blackout && !shadow && !glow && contentCanvas) {
    applyBlackout(canvas, contentCanvas);
  }
  // Glow (highest priority)
  else if (glow && contentCanvas) {
    applyGlow(canvas, contentCanvas, !!messageText);
  }
  // If content canvas was used but no special effect, just draw it
  else if (contentCanvas) {
    ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
  }

  // Messages
  if (messageText) {
    applyMessages(canvas, messageText, useAdrianFont);
  }

  // Parent text for duplicated tokens
  if (dupInfo.duplicated && dupInfo.sourceId > 0) {
    applyParentText(canvas, dupInfo.sourceId);
  }

  // === Step 5: Closeup ===
  let finalCanvas = canvas;
  if (closeup) {
    finalCanvas = applyCloseup(canvas);
  }

  // === Step 6: Post-processing (BN, UV) — AFTER closeup ===
  if (bn) applyBN(finalCanvas);
  if (uv) applyUV(finalCanvas);

  // === Step 7: Export ===
  const buffer = finalCanvas.toBuffer('image/png');
  return { buffer, contentType: 'image/png', isGif: false };
}

// Draw the rotated "OVERDUE" stamp text inside the diagonal frame the SVG
// renders. Position matches the SVG <g transform="translate(80,160) rotate(-12)">
// container — center of an 840×180 box at local (420, 90), which lands at
// roughly (509, 161) in canvas coords after the rotation+translation.
function drawOverdueStamp(ctx) {
  ctx.save();
  ctx.translate(509, 161);
  ctx.rotate((-12 * Math.PI) / 180);

  ctx.fillStyle = '#a8001f';
  ctx.strokeStyle = '#a8001f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // PressStart2P glyphs are roughly 1× font-size wide. "OVERDUE" = 7 chars,
  // so 100px keeps it inside the 840-wide rotated box with ~70px margin.
  try {
    ctx.font = '100px PressStart2P';
  } catch (e) {
    ctx.font = 'bold 100px monospace';
  }
  ctx.lineWidth = 4;
  ctx.strokeText('OVERDUE', 0, 0);
  ctx.fillText('OVERDUE', 0, 0);
  ctx.restore();
}

// Draw the "OVERDUE N DAYS" text into the bottom strip reserved by overdue.svg.
// PressStart2P glyphs are roughly 1× font-size wide. The strip is 1000px wide,
// the longest realistic label is "OVERDUE 999 DAYS" (16 chars), so 56px keeps
// ~50px of margin on each side and is legible at OpenSea thumbnail size.
function drawOverdueDayCounter(ctx, daysOverdue) {
  const days = Math.max(0, Math.min(999, Math.floor(daysOverdue)));
  const label = days === 1 ? 'OVERDUE 1 DAY' : `OVERDUE ${days} DAYS`;

  ctx.save();
  ctx.fillStyle = '#ff3344';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try {
    ctx.font = '56px PressStart2P';
  } catch (e) {
    ctx.font = 'bold 56px monospace';
  }
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 10;
  ctx.strokeText(label, 500, 825);
  ctx.fillText(label, 500, 825);
  ctx.restore();
}

// ===== TAG LOGIC =====

function applyTagLogic(traits, tagInfo, tokenId) {
  if (!tagInfo?.tag) return traits;

  if (tagInfo.tag === 'SubZERO') {
    const config = TAG_CONFIGS.SubZERO;
    const modified = { ...traits };

    // Filter EYES: only allow 1124
    if (modified['EYES'] && !config.allowedEyesTraits.includes(parseInt(modified['EYES']))) {
      delete modified['EYES'];
    }

    // Force SKINTRAIT 1125
    modified['SKINTRAIT'] = String(config.forcedSkinTrait);
    return modified;
  }

  // SamuraiZERO: TOP layer is handled in compositeToken
  return traits;
}

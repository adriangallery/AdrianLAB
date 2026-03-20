// ============================================
// V2 Skin Resolver — Determine which skin/body SVG to render
// ============================================
// Reproduces the exact V1 serum state machine with all edge cases.

import { SKIN_MAP, TAG_CONFIGS } from '../shared/constants.js';
import { loadTraitImage, loadTraitFromCategory } from './trait-loader.js';

// Skin trait exceptions: tokens 37 (Normal) and 38 (3D) have gen-specific SVG paths
const SKIN_TRAIT_EXCEPTIONS = {
  37: (gen) => `SKIN/OG_GEN${gen}.svg`,
  38: (gen) => `SKIN/OG_GEN${gen}_3D.svg`,
};

/**
 * Resolve the skin/body image for a token.
 * Returns an array of images to draw (bottom to top), typically 1 or 2.
 *
 * @param {Object} tokenData - From fetchAllTokenData
 * @param {Object} equippedTraits - Normalized equipped traits
 * @returns {Promise<Array<{image: Image, label: string}>>}
 */
export async function resolveSkin(tokenData, equippedTraits) {
  const {
    effectiveSkinId,
    effectiveSkinName,
    generation,
    appliedSerum,
    serumFailed,
    failedSerumType,
    hasAdrianGFSerum,
    dupInfo,
    tagInfo,
  } = tokenData;

  const gen = generation;
  const images = [];

  // === Priority 1: SKINTRAIT (absolute priority, overrides everything) ===
  if (equippedTraits['SKINTRAIT']) {
    const skintraitId = equippedTraits['SKINTRAIT'];
    const img = await loadTraitImage('SKINTRAIT', skintraitId, {
      customPath: `labimages/${skintraitId}.svg`,
    });
    if (img) {
      images.push({ image: img, label: `SKINTRAIT ${skintraitId}` });
      return images;
    }
  }

  // === Priority 2: Applied serum (successful) ===
  if (appliedSerum) {
    const serumImg = await loadSerumSkin(appliedSerum, gen, effectiveSkinName, dupInfo, hasAdrianGFSerum);
    if (serumImg) {
      images.push({ image: serumImg, label: `serum-${appliedSerum}` });
      return images;
    }
    // If serum image fails, fall through to base skin
    console.warn(`[skin-resolver] Serum ${appliedSerum} image failed, falling through to base skin`);
  }

  // === Priority 3: Failed serum ===
  if (serumFailed && failedSerumType) {
    const failImg = await loadFailedSerumSkin(failedSerumType, gen);
    if (failImg) {
      images.push({ image: failImg, label: `serum-failed-${failedSerumType}` });
      return images;
    }
  }

  // === Priority 4: Skin trait exception (tokens 37, 38 in SKIN category) ===
  if (equippedTraits['SKIN']) {
    const skinId = parseInt(equippedTraits['SKIN']);
    if (SKIN_TRAIT_EXCEPTIONS[skinId]) {
      const exceptPath = SKIN_TRAIT_EXCEPTIONS[skinId](gen);
      const img = await loadTraitImage('SKIN', skinId, { customPath: `traits/${exceptPath}` });
      if (img) {
        images.push({ image: img, label: `skin-exception-${skinId}` });
        // Don't return — still need the base skin below this
      }
    }
  }

  // === Priority 5: Base skin (normal Adrian body) ===
  const skinInfo = SKIN_MAP[String(effectiveSkinId)];

  if (!skinInfo || skinInfo.type === 'mannequin') {
    // Mannequin (no skin assigned)
    const mannequin = await loadTraitImage('MANNEQUIN', 'mannequin', {
      customPath: 'labimages/mannequin.svg',
    });
    if (mannequin) {
      images.unshift({ image: mannequin, label: 'mannequin' });
    } else {
      // Fallback to default Medium
      const fallback = await loadTraitFromCategory('ADRIAN', `GEN${gen}-Medium`);
      if (fallback) images.unshift({ image: fallback, label: 'fallback-medium' });
    }
  } else {
    const skinType = skinInfo.type || effectiveSkinName || 'Medium';
    const baseImg = await loadTraitFromCategory('ADRIAN', `GEN${gen}-${skinType}`);
    if (baseImg) {
      images.unshift({ image: baseImg, label: `base-GEN${gen}-${skinType}` });
    } else {
      // Fallback to Medium
      const fallback = await loadTraitFromCategory('ADRIAN', `GEN${gen}-Medium`);
      if (fallback) images.unshift({ image: fallback, label: 'fallback-medium' });
    }
  }

  return images;
}

/**
 * Resolve SWAG 37/38 skin traits (drawn on top of skin, below other traits)
 */
export async function resolveSkinTraitOverlay(equippedTraits, gen) {
  if (equippedTraits['SWAG'] === '37' || equippedTraits['SWAG'] === '38') {
    const skinTraitId = equippedTraits['SWAG'];
    return loadTraitImage('SKIN_OVERLAY', skinTraitId, {
      customPath: `traits/SKIN/${skinTraitId}.svg`,
    });
  }
  return null;
}

// ===== SERUM SKIN LOADERS =====

async function loadSerumSkin(serumType, gen, skinName, dupInfo, hasAdrianGFSerum) {
  // GoldenAdrian
  if (serumType === 'GoldenAdrian') {
    // Use ADRIAN folder with Golden variant
    const skinType = resolveSkinTypeForSerum(skinName);
    if (dupInfo?.duplicated && dupInfo.dupNumber > 0) {
      // Duplicated GoldenAdrian — use ADRIANGF folder structure
      const path = buildDupSerumPath('ADRIANGF', dupInfo.dupNumber, skinType);
      const img = await loadTraitImage('SERUM_GOLDEN', `GEN${gen}-Golden`, { customPath: `traits/${path}` });
      if (img) return img;
    }
    // Try direct Golden skin
    const img = await loadTraitFromCategory('ADRIAN', `GEN${gen}-Golden`);
    if (img) return img;
    // Fallback to standard Golden Adrian path
    return loadTraitFromCategory('ADRIANGF', `Golden-GEN${gen}`);
  }

  // AdrianGF
  if (serumType === 'AdrianGF') {
    const skinType = resolveSkinTypeForSerum(skinName);
    if (dupInfo?.duplicated && dupInfo.dupNumber > 0) {
      const path = buildDupSerumPath('ADRIANGF', dupInfo.dupNumber, skinType);
      const img = await loadTraitImage('SERUM_GF', `GF${gen}-${skinType}`, { customPath: `traits/${path}` });
      if (img) return img;
    }
    // Standard AdrianGF path
    const img = await loadTraitFromCategory('ADRIANGF', `GF-GEN${gen}-${skinType}`);
    if (img) return img;
    return loadTraitFromCategory('ADRIANGF', `GF-GEN${gen}`);
  }

  // Unknown serum type — try generic path
  return loadTraitImage('SERUM', serumType, { customPath: `labimages/${serumType}.svg` });
}

async function loadFailedSerumSkin(failedType, gen) {
  // Try specific fail variant
  if (failedType === 'GoldenAdrian') {
    const img = await loadTraitFromCategory('ADRIAN', `Golden-Fail`);
    if (img) return img;
  }
  if (failedType === 'AdrianGF') {
    const img = await loadTraitFromCategory('ADRIANGF', `GF-Fail`);
    if (img) return img;
  }
  // Generic fail — fallback to base skin
  return null;
}

function resolveSkinTypeForSerum(skinName) {
  if (!skinName || skinName === 'Zero') return 'Medium';
  return skinName;
}

function buildDupSerumPath(folder, dupNumber, skinType) {
  if (folder === 'ADRIANGF') {
    // Complex naming convention from V1
    if (skinType === 'Albino') return `ADRIANGF/GF${dupNumber}/GEN${dupNumber}_Albino.svg`;
    if (skinType === 'Alien') {
      return dupNumber === 1
        ? `ADRIANGF/GF${dupNumber}/GF${dupNumber}-Alien.svg`
        : `ADRIANGF/GF${dupNumber}/GF${dupNumber}_Alien.svg`;
    }
    if (skinType === 'Dark') return `ADRIANGF/GF${dupNumber}/GF${dupNumber}_Dark.svg`;
    if (skinType === 'Golden') return `ADRIANGF/GF${dupNumber}/GF${dupNumber}_Golden.svg`;
    return `ADRIANGF/GF${dupNumber}/GF${dupNumber}-${skinType}.svg`;
  }
  return `ADRIAN/GEN${dupNumber}-${skinType}.svg`;
}

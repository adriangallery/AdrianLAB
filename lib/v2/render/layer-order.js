// ============================================
// V2 Layer Order — Trait rendering order and exceptions
// ============================================

import {
  TRAIT_ORDER,
  CATEGORY_CORRECTIONS,
  CATEGORY_MAP,
  HEAD_TO_HAIR_TOKENS,
  GEAR_BEFORE_SWAG,
  GEAR_TOP_LAYER,
} from '../shared/constants.js';

/**
 * Normalize and correct equipped traits from on-chain data.
 * Produces a clean map of { CATEGORY: traitId } ready for rendering.
 *
 * @param {string[]} rawCategories - Categories from getAllEquippedTraits
 * @param {number[]} rawTraitIds - Trait IDs from getAllEquippedTraits
 * @returns {Object<string, string>} - Normalized { CATEGORY: 'traitId' }
 */
export function normalizeTraits(rawCategories, rawTraitIds) {
  const traits = {};

  rawCategories.forEach((cat, idx) => {
    let category = CATEGORY_MAP[cat] || cat;
    const traitId = String(rawTraitIds[idx]);

    // Correct mis-categorized tokens
    category = CATEGORY_CORRECTIONS[parseInt(traitId)] || category;

    // HEAD → HAIR remapping for hair-like tokens
    if (category === 'HEAD' && HEAD_TO_HAIR_TOKENS.has(parseInt(traitId))) {
      traits['HAIR'] = traitId;
    } else {
      traits[category] = traitId;
    }
  });

  return traits;
}

/**
 * Get the ordered list of trait entries to render.
 * Handles all special rules: GEAR before SWAG, HAIR 21+HEAD 209 conflict,
 * SERUMS exclusivity with EYES, animated traits skip.
 *
 * @param {Object} traits - Normalized equipped traits
 * @param {Set<string>} animatedTraitIds - Set of trait IDs that are animated (skip in PNG)
 * @returns {Array<{category: string, traitId: string, phase: string}>}
 */
export function getLayerSequence(traits, animatedTraitIds = new Set()) {
  const layers = [];

  // Phase 1: GEAR before SWAG exceptions (721, 726)
  if (traits['GEAR'] && GEAR_BEFORE_SWAG.has(parseInt(traits['GEAR']))) {
    if (!animatedTraitIds.has(traits['GEAR'])) {
      layers.push({ category: 'GEAR', traitId: traits['GEAR'], phase: 'pre-swag' });
    }
  }

  // Phase 2: Main trait order
  for (const category of TRAIT_ORDER) {
    if (!traits[category]) continue;
    const traitId = traits[category];

    // Skip GEAR if already rendered before SWAG
    if (category === 'GEAR' && GEAR_BEFORE_SWAG.has(parseInt(traitId))) continue;

    // Skip HAIR 21 if HEAD 209 is active
    if (category === 'HAIR' && traitId === '21' && traits['HEAD'] === '209') continue;

    // SERUMS exclusivity: skip if EYES is equipped
    if (category === 'SERUMS') {
      const eyes = traits['EYES'];
      if (eyes && eyes !== 'None' && eyes !== '') continue;
    }

    // Skip animated traits (will be in GIF)
    if (animatedTraitIds.has(traitId)) continue;

    layers.push({ category, traitId, phase: 'main' });
  }

  // Phase 3: TOP layers
  if (traits['TOP']) {
    if (!animatedTraitIds.has(traits['TOP'])) {
      layers.push({ category: 'TOP', traitId: traits['TOP'], phase: 'top' });
    }
  }

  // Phase 4: GEAR 48 second pass (S.W.A.T-Shield on top of everything)
  if (traits['GEAR'] && GEAR_TOP_LAYER.has(parseInt(traits['GEAR']))) {
    if (!animatedTraitIds.has(traits['GEAR'])) {
      layers.push({ category: 'GEAR_TOP', traitId: traits['GEAR'], phase: 'gear-top' });
    }
  }

  return layers;
}

/**
 * Determine the subdirectory for loading a specific trait
 * @param {string} category
 * @param {string} traitId
 * @param {Object} tagInfo - Token tag info
 * @returns {{subdir: string|null, customPath: string|null}}
 */
export function getTraitLoadPath(category, traitId, tagInfo) {
  const id = parseInt(traitId);

  // SamuraiZERO TOP traits
  if (category === 'TOP' && tagInfo?.tag === 'SamuraiZERO' && id >= 500 && id <= 1099) {
    return { subdir: 'samuraizero', customPath: null };
  }

  // OG Punks
  if (id >= 100001 && id <= 101003) {
    return { subdir: 'ogpunks', customPath: null };
  }

  // External URL traits (30000-35000) — loaded via HTTP from adrianzero.com
  if (id >= 30000 && id <= 35000) {
    return { subdir: null, customPath: null }; // HTTP path handled by trait-loader
  }

  // GEAR_TOP (second pass of GEAR 48) — load from category path
  if (category === 'GEAR_TOP') {
    return { subdir: null, customPath: `traits/GEAR/${traitId}.svg` };
  }

  // Default: labimages/{traitId}.svg
  return { subdir: null, customPath: null };
}

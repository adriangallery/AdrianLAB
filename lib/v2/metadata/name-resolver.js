// ============================================
// V2 Name Resolver — 7-level priority chain
// ============================================
// Priority: SubZERO > SamuraiZERO > TOP Override > GenZERO > Profile > Custom > Default

import { TAG_CONFIGS } from '../shared/constants.js';

/**
 * Resolve the display name for a token.
 *
 * @param {Object} tokenData - From fetchAllTokenData
 * @param {Object} options
 * @param {number|null} options.samuraiIndex - SamuraiZERO index
 * @param {Object|null} options.samuraiMeta - SamuraiZERO metadata entry
 * @param {string|null} options.topTraitId - TOP trait ID (for AdrianPunk override)
 * @returns {string}
 */
export function resolveTokenName(tokenData, options = {}) {
  const {
    tokenId,
    tagInfo,
    dupInfo,
    profileName,
    nameHistory,
  } = tokenData;

  const { samuraiIndex = null, samuraiMeta = null, topTraitId = null } = options;

  // 1. SubZERO (absolute priority)
  if (tagInfo?.tag === 'SubZERO') {
    return 'SubZERO';
  }

  // 2. SamuraiZERO
  if (tagInfo?.tag === 'SamuraiZERO' && samuraiMeta?.name) {
    return `${samuraiMeta.name} #${tokenId}`;
  }

  // 2.5. ZEROmovies
  if (tagInfo?.tag === 'ZEROmovies' && tokenData._movieName) {
    return `ZEROmovies: ${tokenData._movieName} #${tokenId}`;
  }

  // 3. TOP Trait Override (OGPunk 100001-101000)
  if (topTraitId) {
    const topId = parseInt(topTraitId);
    if (topId >= 100001 && topId <= 101000) {
      return `AdrianPunk #${tokenId}`;
    }
  }

  // 4. GenZERO (duplicated tokens)
  if (dupInfo?.duplicated) {
    return `GenZERO #${tokenId}`;
  }

  // 5. Profile name (from PatientZERO)
  if (profileName) {
    return `${profileName} #${tokenId}`;
  }

  // 6. Custom name (from AdrianNameRegistry)
  if (nameHistory && nameHistory.length > 0) {
    const latestName = nameHistory[nameHistory.length - 1].name;
    if (latestName && latestName.trim()) {
      return `${latestName.trim()} #${tokenId}`;
    }
  }

  // 7. Default
  return `AdrianZero #${tokenId}`;
}

/**
 * Resolve the generation attribute value
 */
export function resolveGeneration(tokenData) {
  if (tokenData.tagInfo?.tag === 'SubZERO') {
    return TAG_CONFIGS.SubZERO.metadataGenOverride;
  }
  if (tokenData.tagInfo?.tag === 'SamuraiZERO') {
    return TAG_CONFIGS.SamuraiZERO.metadataGenOverride;
  }
  if (tokenData.tagInfo?.tag === 'ZEROmovies') {
    return TAG_CONFIGS.ZEROmovies.metadataGenOverride;
  }
  return String(tokenData.originalGeneration);
}

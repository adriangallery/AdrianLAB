import { getTokenTag } from './contracts.js';

/**
 * Configuración de tags y sus lógicas especiales
 * Cada tag puede tener su propia configuración independiente
 */
export const TAG_CONFIGS = {
  SubZERO: {
    allowedEyesTraits: [1124], // Solo permitir EYES 1124
    forcedSkinTrait: 1125,     // Forzar SKINTRAIT 1125 con prioridad absoluta
    metadataGenOverride: 'SubZERO'
  }
  // Futuros tags aquí
};

/**
 * Obtiene información del tag de un token
 * @param {string|number} tokenId - Token ID
 * @returns {Promise<{isMinted: boolean, tag: string|null}>} - Información del tag
 */
export async function getTokenTagInfo(tokenId) {
  try {
    const tokenIdNum = typeof tokenId === 'string' ? parseInt(tokenId) : tokenId;
    if (isNaN(tokenIdNum)) {
      return { isMinted: false, tag: null };
    }
    
    return await getTokenTag(tokenIdNum);
  } catch (error) {
    console.error(`[tag-logic] Error obteniendo tag info para token ${tokenId}:`, error.message);
    return { isMinted: false, tag: null };
  }
}

/**
 * Verifica si se debe aplicar la lógica de un tag específico
 * @param {string|number} tokenId - Token ID
 * @param {string} tagName - Nombre del tag a verificar
 * @returns {Promise<boolean>} - true si se debe aplicar la lógica del tag
 */
export async function shouldApplyTagLogic(tokenId, tagName) {
  const tagInfo = await getTokenTagInfo(tokenId);
  return tagInfo.tag === tagName;
}

/**
 * Aplica la lógica de filtrado de EYES para SubZERO
 * @param {Object} traits - Objeto de traits (equippedTraits o finalTraits)
 * @param {string} tag - Tag del token
 * @returns {Object} - Traits modificados
 */
export function filterEyesForTag(traits, tag) {
  if (tag !== 'SubZERO') {
    return traits;
  }
  
  const config = TAG_CONFIGS.SubZERO;
  if (!config || !config.allowedEyesTraits) {
    return traits;
  }
  
  // Si hay EYES y no está en la lista permitida, eliminarlo
  if (traits['EYES'] && !config.allowedEyesTraits.includes(parseInt(traits['EYES']))) {
    const filteredTraits = { ...traits };
    delete filteredTraits['EYES'];
    console.log(`[tag-logic] EYES ${traits['EYES']} filtrado para SubZERO, solo se permite ${config.allowedEyesTraits.join(', ')}`);
    return filteredTraits;
  }
  
  return traits;
}

/**
 * Aplica la lógica de SKINTRAIT forzado para SubZERO
 * @param {Object} traits - Objeto de traits (equippedTraits o finalTraits)
 * @param {string} tag - Tag del token
 * @returns {Object} - Traits modificados con SKINTRAIT forzado
 */
export function forceSkinTraitForTag(traits, tag) {
  if (tag !== 'SubZERO') {
    return traits;
  }
  
  const config = TAG_CONFIGS.SubZERO;
  if (!config || !config.forcedSkinTrait) {
    return traits;
  }
  
  // Forzar SKINTRAIT con prioridad absoluta
  const modifiedTraits = { ...traits };
  modifiedTraits['SKINTRAIT'] = config.forcedSkinTrait.toString();
  console.log(`[tag-logic] SKINTRAIT ${config.forcedSkinTrait} forzado para SubZERO con prioridad absoluta`);
  
  return modifiedTraits;
}


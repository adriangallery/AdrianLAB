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
  },
  SamuraiZERO: {
    metadataGenOverride: 'SamuraiZERO',
    imageBaseIndex: 500, // Las imágenes empiezan en 500.svg
    metadataJsonPath: '/labmetadata/samuraimetadata.json'
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
  // Asegurar que traits no sea null/undefined
  const modifiedTraits = traits ? { ...traits } : {};
  modifiedTraits['SKINTRAIT'] = config.forcedSkinTrait.toString();
  console.log(`[tag-logic] SKINTRAIT ${config.forcedSkinTrait} forzado para SubZERO con prioridad absoluta`);
  
  return modifiedTraits;
}

/**
 * Obtiene el índice de un SamuraiZERO basado en el orden de mint
 * @param {string|number} tokenId - Token ID
 * @returns {Promise<number|null>} - Índice (0-599) o null si no es SamuraiZERO
 */
export async function getSamuraiZEROIndex(tokenId) {
  try {
    const tokenIdNum = typeof tokenId === 'string' ? parseInt(tokenId) : tokenId;
    if (isNaN(tokenIdNum)) {
      return null;
    }

    const { getTokensByTag, getTokenTag } = await import('./contracts.js');
    const tokenIds = await getTokensByTag('SamuraiZERO');

    if (!tokenIds || tokenIds.length === 0) {
      // Si no hay tokens en la lista pero getTokenTag confirma que es SamuraiZERO,
      // usar índice 0 como fallback
      const tagInfo = await getTokenTag(tokenIdNum);
      if (tagInfo.tag === 'SamuraiZERO') {
        console.log(`[tag-logic] SamuraiZERO token ${tokenId} confirmado por getTokenTag pero lista vacía, usando índice 0`);
        return 0;
      }
      return null;
    }

    // Ordenar tokenIds
    const sortedIds = tokenIds.map(id => parseInt(id.toString())).sort((a, b) => a - b);

    // Encontrar posición del tokenId actual
    const index = sortedIds.indexOf(tokenIdNum);

    if (index === -1) {
      // Token no encontrado en la lista de getTokensByTag, pero verificar si getTokenTag lo confirma
      const tagInfo = await getTokenTag(tokenIdNum);
      if (tagInfo.tag === 'SamuraiZERO') {
        // Es SamuraiZERO según getTokenTag - calcular índice basándose en posición relativa
        // Insertar el tokenId en la lista ordenada y encontrar su posición
        const allIds = [...sortedIds, tokenIdNum].sort((a, b) => a - b);
        const calculatedIndex = allIds.indexOf(tokenIdNum);

        // Asegurar que el índice esté dentro del rango válido (0-599)
        const validIndex = Math.min(calculatedIndex, 599);
        console.log(`[tag-logic] SamuraiZERO token ${tokenId} no en lista pero confirmado por getTokenTag, índice calculado: ${validIndex}`);
        return validIndex;
      }
      return null; // No es SamuraiZERO
    }

    console.log(`[tag-logic] SamuraiZERO token ${tokenId} tiene índice ${index} (de ${sortedIds.length} total)`);
    return index; // 0-599
  } catch (error) {
    console.error(`[tag-logic] Error obteniendo índice SamuraiZERO para token ${tokenId}:`, error.message);
    return null;
  }
}


// Lógica para DuplicatorMODULE
// Funciones para obtener información de duplicación y determinar paths de skins

import { getDupInfo } from './duplicator-cache.js';

/**
 * Obtiene información de duplicación de un token
 * Wrapper sobre getDupInfo del caché para facilitar uso
 * @param {Object} duplicatorModule - Contrato DuplicatorMODULE
 * @param {string|number} tokenId - ID del token
 * @returns {Promise<Object|null>} - Objeto con info de duplicación o null
 */
export async function getTokenDupInfo(duplicatorModule, tokenId) {
  return getDupInfo(duplicatorModule, tokenId);
}

/**
 * Obtiene el path del skin para un token ADRIAN duplicado
 * @param {number} dupNumber - Número de duplicación (1, 2, 3, etc.)
 * @param {string} skinType - Tipo de skin (Albino, Alien, Dark, Light, Medium)
 * @returns {string} - Path del archivo SVG (relativo a /traits/)
 */
export function getDupSkinPathADRIAN(dupNumber, skinType) {
  // Formato: ADRIAN/GEN{dupNumber}-{skinType}.svg
  // dupNumber 1 -> GEN1, dupNumber 2 -> GEN2, etc.
  return `ADRIAN/GEN${dupNumber}-${skinType}.svg`;
}

/**
 * Obtiene el path del skin para un token ADRIANGF duplicado
 * Los archivos en ADRIANGF tienen patrones inconsistentes:
 * - Albino: GEN{n}_Albino.svg
 * - Alien: GF{n}_Alien.svg (GF0, GF2) o GF{n}-Alien.svg (GF1)
 * - Dark: GF{n}_Dark.svg
 * - Light/Medium: GF{n}-Light.svg, GF{n}-Medium.svg
 * @param {number} dupNumber - Número de duplicación (1, 2, 3, etc.)
 * @param {string} skinType - Tipo de skin (Albino, Alien, Dark, Light, Medium, Golden)
 * @returns {string} - Path del archivo SVG (relativo a /traits/)
 */
export function getDupSkinPathADRIANGF(dupNumber, skinType) {
  // Estructura de carpetas: ADRIANGF/GF{dupNumber}/
  const folder = `ADRIANGF/GF${dupNumber}`;

  // Mapear skinType a nombre de archivo según patrones existentes
  let fileName;

  if (skinType === 'Albino') {
    // Albino usa formato: GEN{n}_Albino.svg
    fileName = `GEN${dupNumber}_Albino.svg`;
  } else if (skinType === 'Alien') {
    // Alien tiene inconsistencias:
    // GF0: GF0_Alien.svg
    // GF1: GF1-Alien.svg
    // GF2: GF2_Alien.svg
    if (dupNumber === 1) {
      fileName = `GF${dupNumber}-Alien.svg`;
    } else {
      fileName = `GF${dupNumber}_Alien.svg`;
    }
  } else if (skinType === 'Dark') {
    // Dark usa formato: GF{n}_Dark.svg
    fileName = `GF${dupNumber}_Dark.svg`;
  } else if (skinType === 'Golden') {
    // Golden usa formato: GF{n}_Golden.svg
    fileName = `GF${dupNumber}_Golden.svg`;
  } else {
    // Light, Medium y otros usan formato: GF{n}-{skinType}.svg
    fileName = `GF${dupNumber}-${skinType}.svg`;
  }

  return `${folder}/${fileName}`;
}

/**
 * Obtiene el atributo DupGeneration para metadata
 * @param {number} dupNumber - Número de duplicación
 * @returns {string} - Valor del atributo (ej: "GEN1", "GEN2", "GEN3")
 */
export function getDupGenerationAttribute(dupNumber) {
  return `GEN${dupNumber}`;
}

/**
 * Determina la generación efectiva para un token basándose en dupInfo
 * Si el token está duplicado, usa dupNumber como generación
 * Si no está duplicado, usa la generación original del contrato
 * @param {Object|null} dupInfo - Información de duplicación del token
 * @param {string|number} originalGeneration - Generación original del contrato
 * @returns {string} - Generación efectiva a usar
 */
export function getEffectiveGeneration(dupInfo, originalGeneration) {
  if (dupInfo && dupInfo.duplicated && dupInfo.dupNumber > 0) {
    console.log(`[duplicator-logic] Token duplicado con dupNumber=${dupInfo.dupNumber}, usando GEN${dupInfo.dupNumber}`);
    return dupInfo.dupNumber.toString();
  }
  return originalGeneration.toString();
}

/**
 * Construye el path del skin considerando duplicación y serum
 * @param {Object|null} dupInfo - Información de duplicación
 * @param {string} originalGeneration - Generación original del token
 * @param {string} skinType - Tipo de skin (Albino, Alien, Dark, Light, Medium)
 * @param {boolean} hasAdrianGFSerum - Si el token tiene serum AdrianGF aplicado
 * @returns {string} - Path completo del archivo SVG
 */
export function buildSkinPath(dupInfo, originalGeneration, skinType, hasAdrianGFSerum) {
  const effectiveGen = getEffectiveGeneration(dupInfo, originalGeneration);
  const effectiveGenNum = parseInt(effectiveGen);

  if (hasAdrianGFSerum) {
    console.log(`[duplicator-logic] Usando path ADRIANGF con generación efectiva ${effectiveGenNum}`);
    return getDupSkinPathADRIANGF(effectiveGenNum, skinType);
  } else {
    console.log(`[duplicator-logic] Usando path ADRIAN con generación efectiva ${effectiveGenNum}`);
    return getDupSkinPathADRIAN(effectiveGenNum, skinType);
  }
}

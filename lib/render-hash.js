/**
 * Sistema de hash para renders
 * Genera un hash único basado en todas las variables que afectan al render final
 */

import crypto from 'crypto';

/**
 * Genera un hash único para un render basado en todas sus variables
 * @param {Object} renderParams - Todas las variables que afectan al render
 * @returns {string} - Hash único (SHA-256, primeros 16 caracteres)
 */
export function generateRenderHash(renderParams) {
  const {
    // Query parameters
    closeup = false,
    shadow = false,
    glow = false,
    bn = false,
    uv = false,
    blackout = false,
    banana = false,
    messages = null,
    
    // Token data
    generation = '0',
    mutationLevel = '0',
    canReplicate = false,
    hasBeenModified = false,
    
    // Skin
    skinId = '0',
    skinName = '',
    
    // Traits (ordenados por categoría)
    traitCategories = [],
    traitIds = [],
    
    // Serum
    appliedSerum = null,
    serumFailed = false,
    failedSerumType = null,
    hasAdrianGFSerum = false,
    serumHistory = null, // Array completo para conversiones complejas
    
    // SKINTRAIT
    skintraitId = null,
    
    // Tags especiales
    tag = null,
    tagIndex = null
  } = renderParams;
  
  // Normalizar valores a strings consistentes
  const normalizedData = {
    // Query parameters (booleans)
    closeup: closeup ? '1' : '0',
    shadow: shadow ? '1' : '0',
    glow: glow ? '1' : '0',
    bn: bn ? '1' : '0',
    uv: uv ? '1' : '0',
    blackout: blackout ? '1' : '0',
    banana: banana ? '1' : '0',
    messages: messages ? String(messages) : '',
    
    // Token data
    generation: String(generation),
    mutationLevel: String(mutationLevel),
    canReplicate: canReplicate ? '1' : '0',
    hasBeenModified: hasBeenModified ? '1' : '0',
    
    // Skin
    skinId: String(skinId),
    skinName: String(skinName),
    
    // Traits (ordenados y normalizados)
    // Formato: "CATEGORY1:traitId1,CATEGORY2:traitId2,..."
    traits: generateTraitsString(traitCategories, traitIds),
    
    // Serum
    appliedSerum: appliedSerum || '',
    serumFailed: serumFailed ? '1' : '0',
    failedSerumType: failedSerumType || '',
    hasAdrianGFSerum: hasAdrianGFSerum ? '1' : '0',
    // Para conversiones complejas, incluir historial completo
    serumHistory: generateSerumHistoryString(serumHistory),
    
    // SKINTRAIT
    skintraitId: skintraitId ? String(skintraitId) : '',
    
    // Tags
    tag: tag || '',
    tagIndex: tagIndex !== null ? String(tagIndex) : ''
  };
  
  // Convertir a JSON string (ordenado para consistencia)
  const jsonString = JSON.stringify(normalizedData, Object.keys(normalizedData).sort());
  
  // Generar hash SHA-256
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  
  // Retornar primeros 16 caracteres (suficiente para unicidad)
  return hash.substring(0, 16);
}

/**
 * Genera string normalizado de traits
 * @param {Array} categories - Categorías de traits
 * @param {Array} traitIds - IDs de traits
 * @returns {string} - String normalizado
 */
function generateTraitsString(categories, traitIds) {
  if (!categories || !traitIds || categories.length !== traitIds.length) {
    return '';
  }
  
  // Crear array de pares [categoria, traitId]
  const pairs = categories.map((cat, idx) => [cat, String(traitIds[idx])]);
  
  // Ordenar por categoría y luego por traitId para consistencia
  pairs.sort((a, b) => {
    if (a[0] !== b[0]) {
      return a[0].localeCompare(b[0]);
    }
    return a[1].localeCompare(b[1]);
  });
  
  // Formato: "CATEGORY1:traitId1,CATEGORY2:traitId2,..."
  return pairs.map(([cat, id]) => `${cat}:${id}`).join(',');
}

/**
 * Genera string normalizado del historial de serum
 * Para conversiones complejas (ej: GF-Goldfail)
 * @param {Array|null} serumHistory - Historial completo de serums
 * @returns {string} - String normalizado
 */
function generateSerumHistoryString(serumHistory) {
  if (!serumHistory || !Array.isArray(serumHistory) || serumHistory.length === 0) {
    return '';
  }
  
  // Formato: "success1:mutation1,success2:mutation2,..."
  // Solo incluir serums relevantes (GoldenAdrian, AdrianGF)
  const relevantSerums = serumHistory
    .filter(serum => {
      const mutation = serum[3];
      return mutation === 'GoldenAdrian' || mutation === 'AdrianGF';
    })
    .map(serum => {
      const success = serum[1] ? '1' : '0';
      const mutation = serum[3] || '';
      return `${success}:${mutation}`;
    });
  
  return relevantSerums.join(',');
}

/**
 * Genera el nombre de archivo para un render
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @returns {string} - Nombre del archivo (ej: "123_a1b2c3d4e5f6g7h8.png")
 */
export function getRenderFilename(tokenId, hash) {
  return `${tokenId}_${hash}.png`;
}

/**
 * Extrae el hash del nombre de archivo
 * @param {string} filename - Nombre del archivo (ej: "123_a1b2c3d4e5f6g7h8.png")
 * @returns {string|null} - Hash extraído o null si no se puede extraer
 */
export function extractHashFromFilename(filename) {
  const match = filename.match(/^(\d+)_([a-f0-9]{16})\.png$/);
  if (match) {
    return match[2];
  }
  return null;
}

/**
 * Genera un hash único para un trait individual
 * @param {string} traitId - ID del trait
 * @returns {string} - Hash único (SHA-256, primeros 16 caracteres)
 */
export function generateTraitHash(traitId) {
  const normalizedData = {
    traitId: String(traitId)
  };
  
  const jsonString = JSON.stringify(normalizedData);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  
  return hash.substring(0, 16);
}

/**
 * Genera un hash único para un floppy simplificado
 * @param {string} tokenId - ID del token
 * @returns {string} - Hash único (SHA-256, primeros 16 caracteres)
 */
export function generateFloppySimpleHash(tokenId) {
  const normalizedData = {
    tokenId: String(tokenId),
    simple: '1' // Siempre true para floppy simple
  };
  
  const jsonString = JSON.stringify(normalizedData);
  const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
  
  return hash.substring(0, 16);
}

/**
 * Genera el nombre de archivo para un trait
 * @param {string} traitId - ID del trait
 * @param {string} hash - Hash único del render
 * @returns {string} - Nombre del archivo (ej: "123_trait_a1b2c3d4e5f6g7h8.png")
 */
export function getTraitFilename(traitId, hash) {
  return `${traitId}_trait_${hash}.png`;
}

/**
 * Genera el nombre de archivo para un floppy simple
 * @param {string} tokenId - ID del token
 * @param {string} hash - Hash único del render
 * @returns {string} - Nombre del archivo (ej: "123_floppy_simple_a1b2c3d4e5f6g7h8.png")
 */
export function getFloppySimpleFilename(tokenId, hash) {
  return `${tokenId}_floppy_simple_${hash}.png`;
}


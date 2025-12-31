/**
 * Helper para detectar y manejar traits animados
 * Detecta traits con "Type": "Animated" en traits.json y sus variantes
 */

import fs from 'fs';
import path from 'path';

const ANIMATED_DELAY = 500; // Delay fijo de 500ms para todos los traits animados

/**
 * Cargar traits.json
 */
async function loadTraitsJson() {
  const traitsPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
  
  if (!fs.existsSync(traitsPath)) {
    console.warn('[animated-traits-helper] traits.json no encontrado');
    return null;
  }
  
  try {
    const traitsBuffer = fs.readFileSync(traitsPath);
    const traitsData = JSON.parse(traitsBuffer.toString());
    return traitsData.traits || [];
  } catch (error) {
    console.error('[animated-traits-helper] Error cargando traits.json:', error.message);
    return null;
  }
}

/**
 * Detectar variantes de un trait animado (1165 -> 1165a, 1165b, etc.)
 */
async function detectAnimatedVariants(baseId) {
  const variants = [];
  const letters = 'abcdefghij'.split(''); // Solo buscar hasta 10 variantes (a-j)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
  
  // IMPORTANTE: Solo buscamos variantes con letras (ej: 1165a, 1165b)
  // NO incluimos el archivo base sin letra (ej: 1165.svg) - ese es para otros renders
  const checkPromises = letters.map(async (letter) => {
    const variantId = `${baseId}${letter}`; // Siempre con letra: 1165a, 1165b, etc.
    const url = `${baseUrl}/labimages/${variantId}.svg`;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return variantId;
      }
    } catch (e) {
      // Ignorar errores
    }
    return null;
  });
  
  const results = await Promise.all(checkPromises);
  // Filtrar resultados y asegurar que solo incluimos variantes con letra
  return results.filter(v => v !== null && v !== baseId);
}

/**
 * Obtener traits animados desde una lista de traitIds
 * @param {Array<number|string>} traitIds - Array de IDs de traits
 * @returns {Promise<Array>} Array de objetos con { baseId, variants, delay }
 */
export async function getAnimatedTraits(traitIds) {
  if (!traitIds || traitIds.length === 0) {
    return [];
  }
  
  const traits = await loadTraitsJson();
  if (!traits) {
    return [];
  }
  
  const animatedTraits = [];
  
  // Convertir traitIds a números para comparación
  const traitIdsNum = traitIds.map(id => parseInt(id.toString()));
  
  // Buscar traits animados
  for (const trait of traits) {
    if (traitIdsNum.includes(trait.tokenId) && trait.Type === 'Animated') {
      console.log(`[animated-traits-helper] Trait animado detectado: ${trait.tokenId} (${trait.name})`);
      
      // Detectar variantes
      const variants = await detectAnimatedVariants(trait.tokenId.toString());
      
      if (variants.length > 0) {
        animatedTraits.push({
          baseId: trait.tokenId.toString(),
          name: trait.name,
          category: trait.category,
          variants: variants,
          delay: ANIMATED_DELAY
        });
        console.log(`[animated-traits-helper] Trait ${trait.tokenId}: ${variants.length} variantes encontradas (${variants.join(', ')})`);
      } else {
        console.warn(`[animated-traits-helper] Trait ${trait.tokenId} marcado como animado pero no se encontraron variantes`);
      }
    }
  }
  
  return animatedTraits;
}

/**
 * Verificar si un trait específico es animado
 * @param {number|string} traitId - ID del trait
 * @returns {Promise<boolean>} True si el trait es animado
 */
export async function isTraitAnimated(traitId) {
  const traits = await loadTraitsJson();
  if (!traits) {
    return false;
  }
  
  const traitIdNum = parseInt(traitId.toString());
  const trait = traits.find(t => t.tokenId === traitIdNum);
  
  return trait && trait.Type === 'Animated';
}

/**
 * Obtener el delay por defecto para traits animados
 * @returns {number} Delay en milisegundos
 */
export function getAnimatedDelay() {
  return ANIMATED_DELAY;
}


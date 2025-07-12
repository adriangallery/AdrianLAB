/**
 * Configuración del orden y lógica de las capas de traits
 */

// Orden base de las capas (de abajo a arriba)
export const BASE_LAYER_ORDER = [
  "BACKGROUND",  // Fondo (siempre primero)
  "ADRIAN",      // Base del personaje
  "SKIN",        // Piel
  "MUTATION"     // Mutaciones
];

// Categorías adicionales que pueden ir encima de las capas base
export const ADDITIONAL_LAYERS = [
  "GEAR",        // Equipamiento
  "HEAD",        // Cabeza
  "EYES",        // Ojos (después de HEAD)
  "MOUTH",       // Boca
  "CLOTHING",    // Ropa
  "ACCESSORIES"  // Accesorios
];

// Categorías que van encima de todas las demás (TOP layer)
export const TOP_LAYERS = [
  "TOP"          // TOP va encima de todas las otras capas
];

// Orden completo de todas las capas
export const COMPLETE_LAYER_ORDER = [...BASE_LAYER_ORDER, ...ADDITIONAL_LAYERS, ...TOP_LAYERS];

// Mapeo de IDs de generación a carpetas
export const GENERATION_FOLDERS = {
  0: "ADRIAN",  // Gen0 usa la carpeta ADRIAN
  1: "GEN1",    // Gen1 usa la carpeta GEN1
  2: "GEN2",    // Gen2 usa la carpeta GEN2
  11: "GEN11"   // Gen11 usa la carpeta GEN11
};

/**
 * Procesa la información del token desde el contrato
 * @param {Object} tokenInfo - Información del token desde getCompleteTokenInfo
 * @returns {Object} - Información procesada para el renderizado
 */
export function processTokenInfo(tokenInfo) {
  const { tokenId, generation, mutationLevel, canReplicate, replicationCount, 
          lastReplication, hasBeenModified, skinId, traits = [] } = tokenInfo;

  // Determinar la carpeta base según la generación
  const baseFolder = GENERATION_FOLDERS[generation] || "ADRIAN";

  // Construir las categorías y traitIds en el orden correcto
  const categories = [];
  const traitIds = [];

  // 1. Añadir BACKGROUND si existe
  const backgroundTrait = traits.find(t => t.category === "BACKGROUND");
  if (backgroundTrait) {
    categories.push("BACKGROUND");
    traitIds.push(backgroundTrait.traitId);
  } else {
    // Si no hay BACKGROUND, usar el default
    categories.push("BACKGROUND");
    traitIds.push(1);
  }

  // 2. Añadir la base según la generación
  categories.push(baseFolder);
  traitIds.push(1); // Siempre usamos el trait 1 para la base

  // 3. Añadir SKIN si existe y es mayor que 0
  if (skinId > 0) {
    categories.push("SKIN");
    traitIds.push(skinId);
  } else {
    // Si no hay SKIN, usar el default
    categories.push("SKIN");
    traitIds.push(0);
  }

  // 4. Añadir MUTATION si existe y el nivel es > 0
  if (mutationLevel > 0) {
    categories.push("MUTATION");
    traitIds.push(mutationLevel);
  }

  // 5. Añadir el resto de traits en el orden correcto
  ADDITIONAL_LAYERS.forEach(category => {
    const trait = traits.find(t => t.category === category);
    if (trait) {
      categories.push(category);
      traitIds.push(trait.traitId);
    } else {
      // Si no hay trait para esta categoría, usar el default
      categories.push(category);
      traitIds.push(1);
    }
  });

  // 6. Añadir TOP layers (van encima de todas las demás)
  TOP_LAYERS.forEach(category => {
    const trait = traits.find(t => t.category === category);
    if (trait) {
      categories.push(category);
      traitIds.push(trait.traitId);
    }
    // No añadir default para TOP, solo si existe el trait
  });

  return {
    tokenId,
    generation,
    mutationLevel,
    canReplicate,
    replicationCount,
    lastReplication,
    hasBeenModified,
    categories,
    traitIds,
    version: Date.now() // Usamos timestamp para forzar actualización
  };
}

/**
 * Verifica si una capa debe ser renderizada
 * @param {string} category - Categoría de la capa
 * @param {number} traitId - ID del trait
 * @returns {boolean} - Si la capa debe ser renderizada
 */
export function shouldRenderLayer(category, traitId) {
  // No renderizar si no hay trait asignado
  if (!traitId || traitId === 0) return false;

  // BACKGROUND siempre se renderiza si existe
  if (category === "BACKGROUND") return true;

  // ADRIAN siempre se renderiza
  if (category === "ADRIAN") return true;

  // SKIN se renderiza si existe
  if (category === "SKIN") return true;

  // MUTATION se renderiza si el nivel es > 0
  if (category === "MUTATION") return traitId > 0;

  // TOP se renderiza si existe (siempre va encima)
  if (category === "TOP") return true;

  // Para el resto de capas, se renderizan si tienen un trait asignado
  return true;
}

/**
 * Obtiene el orden de renderizado de las capas
 * @returns {string[]} - Array con el orden de las capas
 */
export function getLayerOrder() {
  return COMPLETE_LAYER_ORDER;
} 
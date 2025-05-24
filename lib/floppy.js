/**
 * Biblioteca para manejar los FLOPPY DISKS (packs)
 * Esto simulará la interacción con el futuro contrato AdrianTraits
 */

/**
 * Obtiene los datos de un FLOPPY DISK específico
 * @param {string|number} tokenId - ID del FLOPPY DISK
 * @returns {Promise<Object>} - Datos del FLOPPY DISK
 */
export async function getFloppyData(tokenId) {
  try {
    // En el futuro, esto se conectará al contrato AdrianTraits en la blockchain
    
    // Para el token 1 (prueba)
    if (parseInt(tokenId) === 1) {
      return {
        tokenId: 1,
        name: "Starter Pack Alpha",
        description: "Un pack inicial con traits básicos para tu personaje Adrian",
        floppyType: "Starter",
        rarity: "Common",
        containsTraits: [1, 2, 3, 4, 5],
        image: 1, // Usa la imagen 1.png
        version: 1 // Para control de caché en OpenSea
      };
    }
    
    // Para otros tokens, generamos datos aleatorios basados en el tokenId
    const seed = parseInt(tokenId);
    const floppyTypes = ["Starter", "Premium", "Legendary", "Limited", "Special"];
    const rarities = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
    
    // Determinar tipo y rareza basados en el tokenId
    const floppyType = floppyTypes[seed % floppyTypes.length];
    const rarity = rarities[seed % rarities.length];
    
    // Generar una lista de traits incluidos
    const numTraits = 3 + (seed % 5); // Entre 3 y 7 traits
    const containsTraits = [];
    
    for (let i = 0; i < numTraits; i++) {
      containsTraits.push((seed * 10) + i);
    }
    
    // Determinar qué imagen usar (alternamos entre 1 y 2)
    const imageId = (seed % 2) + 1;
    
    return {
      tokenId: parseInt(tokenId),
      name: `${floppyType} Pack #${tokenId}`,
      description: `Un pack de tipo ${floppyType} con ${numTraits} traits para tu personaje Adrian`,
      floppyType,
      rarity,
      containsTraits,
      image: imageId,
      version: 1 // Versión base para tokens regulares
    };
  } catch (error) {
    console.error('Error al obtener datos del FLOPPY DISK:', error);
    throw error;
  }
}

/**
 * Verifica si un FLOPPY DISK contiene un trait específico
 * @param {string|number} floppyId - ID del FLOPPY DISK
 * @param {string|number} traitId - ID del trait a verificar
 * @returns {Promise<boolean>} - True si el FLOPPY contiene el trait
 */
export async function floppyContainsTrait(floppyId, traitId) {
  try {
    const floppyData = await getFloppyData(floppyId);
    return floppyData.containsTraits.includes(parseInt(traitId));
  } catch (error) {
    console.error(`Error al verificar si el FLOPPY ${floppyId} contiene el trait ${traitId}:`, error);
    return false;
  }
} 
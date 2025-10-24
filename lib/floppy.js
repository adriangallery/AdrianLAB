/**
 * Biblioteca para manejar los FLOPPY DISKS (packs)
 * Lee datos desde floppy.json
 */

import fs from 'fs';
import path from 'path';

/**
 * Obtiene los datos de un FLOPPY DISK específico
 * @param {string|number} tokenId - ID del FLOPPY DISK
 * @returns {Promise<Object>} - Datos del FLOPPY DISK
 */
export async function getFloppyData(tokenId) {
  try {
    const tokenIdNum = parseInt(tokenId);
    
    // Cargar datos desde floppy.json
    const floppyPath = path.join(process.cwd(), 'public', 'labmetadata', 'floppy.json');
    
    if (!fs.existsSync(floppyPath)) {
      throw new Error('Archivo floppy.json no encontrado');
    }
    
    const floppyBuffer = fs.readFileSync(floppyPath);
    const floppyData = JSON.parse(floppyBuffer.toString());
    
    // Buscar el floppy específico
    const floppy = floppyData.floppys.find(f => f.tokenId === tokenIdNum);
    
    if (!floppy) {
      throw new Error(`Floppy con ID ${tokenIdNum} no encontrado`);
    }
    
    // Generar traits incluidos basados en traitsInside
    const containsTraits = [];
    const numTraits = floppy.traitsInside || 0;
    
    // Generar IDs de traits basados en el tokenId y el número de traits
    for (let i = 0; i < numTraits; i++) {
      containsTraits.push((tokenIdNum * 100) + i + 1);
    }
    
    return {
      tokenId: floppy.tokenId,
      name: floppy.name,
      description: floppy.description,
      floppyType: floppy.floppy,
      rarity: floppy.maxSupply === "TBD" ? "Unknown" : 
              floppy.maxSupply <= 10 ? "Legendary" :
              floppy.maxSupply <= 50 ? "Epic" :
              floppy.maxSupply <= 200 ? "Rare" :
              floppy.maxSupply <= 500 ? "Uncommon" : "Common",
      containsTraits,
      image: floppy.tokenId, // Usa el tokenId como imagen
      version: Date.now() // Para control de caché
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
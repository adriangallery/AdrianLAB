import { getFloppyData } from '../../../../lib/floppy.js';
import { getAssetInfo } from '../../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    // Extraer packId de la consulta
    let { packId } = req.query;
    
    // Verificar que el packId es válido
    if (!packId || isNaN(parseInt(packId))) {
      return res.status(400).json({ error: 'ID de pack inválido' });
    }
    
    // Convertir a entero
    packId = parseInt(packId);
    
    // Obtener datos del FLOPPY DISK
    let floppyData;
    try {
      floppyData = await getFloppyData(packId);
    } catch (error) {
      console.error(`Error al obtener datos del FLOPPY DISK ${packId}:`, error);
      return res.status(500).json({ error: 'Error al obtener datos del FLOPPY DISK' });
    }
    
    // Configurar URL base para imágenes
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://adrianlab.vercel.app';
    
    // Obtener información de cada trait contenido en el pack
    const possibleTraits = [];
    
    for (const traitId of floppyData.containsTraits) {
      try {
        const assetInfo = await getAssetInfo(traitId);
        
        if (assetInfo) {
          // Determinar rareza en base a maxSupply
          let rarity = "common";
          if (assetInfo.maxSupply <= 10) {
            rarity = "legendary";
          } else if (assetInfo.maxSupply <= 50) {
            rarity = "epic";
          } else if (assetInfo.maxSupply <= 200) {
            rarity = "rare";
          }
          
          possibleTraits.push({
            trait_id: traitId,
            name: assetInfo.name,
            category: assetInfo.category,
            preview_image: `${baseUrl}/api/trait/${traitId}`,
            rarity: rarity
          });
        }
      } catch (error) {
        console.error(`Error al obtener información del trait ${traitId}:`, error);
        // Continuar con el siguiente trait
      }
    }
    
    // Información del pack
    const packInfo = {
      pack_id: packId.toString(),
      pack_image: `${baseUrl}/api/floppy/render/${packId}`,
      pack_name: floppyData.name,
      pack_type: floppyData.floppyType,
      pack_rarity: floppyData.rarity,
      possible_traits: possibleTraits
    };
    
    // Devolver la información
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60'); // Caché de 1 minuto
    res.status(200).json(packInfo);
  } catch (error) {
    console.error('Error en el handler de preview de traits:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
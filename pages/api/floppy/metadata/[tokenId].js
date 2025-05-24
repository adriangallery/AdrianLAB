import { getFloppyData } from '../../../../lib/floppy.js';

export default async function handler(req, res) {
  try {
    // Extraer tokenId de la consulta
    let { tokenId } = req.query;
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'ID de token inválido' });
    }
    
    // Convertir a entero
    tokenId = parseInt(tokenId);
    
    // Obtener datos del FLOPPY DISK
    let floppyData;
    try {
      floppyData = await getFloppyData(tokenId);
    } catch (error) {
      console.error(`Error al obtener datos del FLOPPY DISK ${tokenId}:`, error);
      return res.status(500).json({ error: 'Error al obtener datos del FLOPPY DISK' });
    }
    
    // Configurar URL base para imágenes
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://adrianlab.vercel.app';
    
    // Metadatos del FLOPPY DISK
    const metadata = {
      name: floppyData.name,
      description: floppyData.description,
      image: `${baseUrl}/api/floppy/render/${tokenId}.png?v=${floppyData.version || 1}`,
      external_url: `${baseUrl}/floppy/${tokenId}`,
      attributes: [
        {
          trait_type: "Tipo de Pack",
          value: floppyData.floppyType
        },
        {
          trait_type: "Rareza",
          value: floppyData.rarity
        },
        {
          trait_type: "Número de Traits",
          value: floppyData.containsTraits.length
        }
      ]
    };
    
    // Devolver los metadatos
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60'); // Caché de 1 minuto
    res.status(200).json(metadata);
  } catch (error) {
    console.error('Error en el handler de metadatos de FLOPPY DISK:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
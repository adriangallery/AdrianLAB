import { getTokenTraits, getRarityPercentage } from '../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Token ID inválido' });
    }
    
    try {
      // Obtener datos del token desde la blockchain (simulado)
      const tokenData = await getTokenTraits(parseInt(tokenId));
      
      // Construcción de la URL base para imágenes
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'https://adrianlab.vercel.app';
      
      // Ejemplo de metadatos para el token
      const metadata = {
        name: `BareAdrian #${tokenId}`,
        description: `A ${tokenData.bodyTypeName} BareAdrian from the AdrianLab collection`,
        image: `${baseUrl}/api/render/${tokenId}`,
        external_url: `${baseUrl}/token/${tokenId}`,
        attributes: [
          {
            trait_type: "Body Type",
            value: tokenData.bodyTypeName
          },
          {
            trait_type: "Generation",
            value: tokenData.generation
          },
          {
            trait_type: "Mutation Level", 
            value: ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel]
          },
          {
            trait_type: "Can Replicate",
            value: tokenData.canReplicate ? "Yes" : "No"
          },
          {
            trait_type: "Has Been Modified",
            value: tokenData.hasBeenModified ? "Yes" : "No"
          }
        ]
      };
      
      // Añadir rareza del body type si no es básico
      if (tokenData.bodyTypeId > 0) {
        // Calcular rareza basada en el bodyTypeId
        const rarityPercentage = await getRarityPercentage(tokenData.bodyTypeId);
        metadata.attributes.push({
          trait_type: "Body Rarity",
          value: `${rarityPercentage}%`
        });
      }
      
      // Añadir rasgos del token como atributos
      for (let i = 0; i < tokenData.categories.length; i++) {
        const category = tokenData.categories[i];
        const traitId = tokenData.traitIds[i];
        
        // Solo añadir si tiene un trait asignado (traitId > 0)
        if (traitId > 0 && category !== "BASE") { // BASE ya está representado como Body Type
          metadata.attributes.push({
            trait_type: category.charAt(0) + category.slice(1).toLowerCase(), // Format: "Background", "Eyes", etc.
            value: `#${traitId}`
          });
        }
      }
      
      // Configurar headers para permitir caché
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.status(200).json(metadata);
    } catch (error) {
      console.error(`Error obteniendo datos del token ${tokenId}:`, error);
      return res.status(404).json({ error: 'Token not found or data unavailable' });
    }
  } catch (error) {
    console.error('Error al obtener metadata:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
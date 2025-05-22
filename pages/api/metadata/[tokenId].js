import { getTokenTraits } from '../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verificar que el tokenId es válido
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Token ID inválido' });
    }
    
    // Construcción de la URL base para imágenes
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://adrianlab.vercel.app';
    
    // Ejemplo de metadatos para el token
    const metadata = {
      name: `AdrianLAB #${tokenId}`,
      description: "AdrianLAB es una colección de NFTs generativos con rasgos únicos.",
      image: `${baseUrl}/api/render/${tokenId}`,
      external_url: `https://adrianlab.com/token/${tokenId}`,
      attributes: [
        {
          trait_type: "Ejemplo",
          value: "Metadata Temporal"
        }
      ]
    };
    
    // Configurar headers para permitir caché
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(metadata);
  } catch (error) {
    console.error('Error al obtener metadata:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
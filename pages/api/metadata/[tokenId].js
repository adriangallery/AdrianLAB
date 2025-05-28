import { getRawTokenMetadata } from '../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    try {
      const tokenData = await getRawTokenMetadata(parseInt(tokenId));

      // Simulación hasta tener datos reales de rarity
      const rarity = "1.00%";

      // Build base URL for images
      const baseUrl = 'https://adrianlab.vercel.app';

      // Calcular versión basada en los datos del token
      const version = Date.now(); // Esto forzará una recarga en cada cambio

      const metadata = {
        name: `BareAdrian #${tokenId}`,
        description: `A SVG Gen${tokenData.generation} BareAdrian from the AdrianLab collection`,
        image: `${baseUrl}/api/render/${tokenId}.png?v=${version}`,
        external_url: `${baseUrl}/token/${tokenId}`,
        attributes: [
          { trait_type: "Body Type", value: `SVG Gen${tokenData.generation}` },
          { trait_type: "Generation", value: tokenData.generation },
          { trait_type: "Mutation Level", value: ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel] },
          { trait_type: "Can Replicate", value: tokenData.canReplicate ? "Yes" : "No" },
          { trait_type: "Has Been Modified", value: tokenData.hasBeenModified ? "Yes" : "No" },
          { trait_type: "Body Rarity", value: rarity },
          { trait_type: "Background", value: "#1" },
          { trait_type: "Adrian", value: "#1" },
          { trait_type: "Skin", value: "#1" },
          { trait_type: "Gear", value: "#1" },
          { trait_type: "Head", value: "#1" },
          { trait_type: "Mouth", value: "#1" },
          { trait_type: "Eyes", value: "#1" }
        ]
      };

      // Configure headers to allow cache
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
      return res.status(200).json(metadata);
    } catch (error) {
      console.error(`Error getting token data ${tokenId}:`, error);
      return res.status(404).json({ error: 'Token not found or data unavailable' });
    }
  } catch (error) {
    console.error('Error getting metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
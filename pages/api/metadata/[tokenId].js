import { getRawTokenMetadata } from '../../../lib/blockchain.js';
import { getContracts } from '../../../lib/contracts.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Build base URL for images
    const baseUrl = 'https://adrianlab.vercel.app';
    const version = Date.now(); // Esto forzará una recarga en cada cambio

    // Metadata base que siempre se mostrará
    const baseMetadata = {
      name: `BareAdrian #${tokenId}`,
      description: `A BareAdrian from the AdrianLab collection`,
      image: `${baseUrl}/api/render/${tokenId}.png?v=${version}`,
      external_url: `${baseUrl}/token/${tokenId}`,
      attributes: []
    };
    
    try {
      // Test de conexión al contrato
      const { extensions } = await getContracts();
      console.log('Contrato EXTENSIONS conectado:', extensions.address);

      const tokenData = await getRawTokenMetadata(parseInt(tokenId));
      
      // Actualizar metadata con datos del contrato
      baseMetadata.description = `A SVG Gen${tokenData.generation} BareAdrian from the AdrianLab collection`;
      baseMetadata.attributes = [
        { trait_type: "Body Type", value: `SVG Gen${tokenData.generation}` },
        { trait_type: "Generation", value: tokenData.generation },
        { trait_type: "Mutation Level", value: ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel] },
        { trait_type: "Can Replicate", value: tokenData.canReplicate ? "Yes" : "No" },
        { trait_type: "Has Been Modified", value: tokenData.hasBeenModified ? "Yes" : "No" }
      ];
    } catch (error) {
      console.error(`Error getting token data ${tokenId}:`, error);
      // Si falla la lectura del contrato, mantenemos la metadata base
    }

    // Configure headers to allow cache
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).json(baseMetadata);
  } catch (error) {
    console.error('Error getting metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
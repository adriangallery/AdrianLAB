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
      name: `AdrianZero #${tokenId}`,
      description: `An AdrianZero from the AdrianLAB collection`,
      image: `${baseUrl}/api/render/${tokenId}.png?v=${version}`,
      external_url: `${baseUrl}/token/${tokenId}`,
      metadata_version: "2", // Versión actual de la metadata
      attributes: []
    };
    
    try {
      // Test de conexión al contrato
      const { extensions } = await getContracts();
      console.log('Contrato EXTENSIONS conectado:', extensions.address);

      // Obtener datos crudos del contrato
      const rawData = await extensions.getCompleteTokenInfo(tokenId);
      console.log('Datos crudos del contrato:', JSON.stringify(rawData, null, 2));

      // Convertir BigNumber a números
      const tokenData = {
        tokenId: rawData[0].toNumber(),
        generation: rawData[1].toNumber(),
        mutationLevel: rawData[2],
        canReplicate: rawData[3],
        replicationCount: rawData[4].toNumber(),
        lastReplication: rawData[5].toNumber(),
        hasBeenModified: rawData[6],
        skinId: rawData[7].toNumber(),
        traits: rawData[8] || []
      };
      
      console.log('Datos procesados del token:', JSON.stringify(tokenData, null, 2));
      
      // Actualizar metadata con datos del contrato
      baseMetadata.description = `A Gen${tokenData.generation} AdrianZero from the AdrianLAB collection`;
      baseMetadata.attributes = [
        { trait_type: "Body Type", value: `Gen${tokenData.generation}` },
        { trait_type: "Generation", value: tokenData.generation },
        { trait_type: "Mutation Level", value: ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel] },
        { trait_type: "Can Replicate", value: tokenData.canReplicate ? "Yes" : "No" },
        { trait_type: "Has Been Modified", value: tokenData.hasBeenModified ? "Yes" : "No" },
        { trait_type: "Skin", value: `#${tokenData.skinId}` }
      ];
    } catch (error) {
      console.error(`Error getting token data ${tokenId}:`, error);
    }

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    return res.status(200).json(baseMetadata);
  } catch (error) {
    console.error('Error getting metadata:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
import { getRawTokenMetadata } from '../../../lib/blockchain.js';
import { getContracts } from '../../../lib/contracts.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    console.log(`[metadata] Iniciando request para token ${tokenId}`);
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      console.error(`[metadata] Token ID inválido: ${tokenId}`);
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
      console.log('[metadata] Intentando conectar con los contratos...');
      const { extensions, core } = await getContracts();
      console.log('[metadata] Contratos conectados:', {
        extensions: extensions.address,
        core: core.address
      });

      // Obtener datos del token
      console.log('[metadata] Obteniendo datos del token...');
      const tokenData = await getRawTokenMetadata(tokenId);
      console.log('[metadata] Datos del token:', JSON.stringify(tokenData, null, 2));
      
      // Actualizar metadata con datos del contrato
      console.log('[metadata] Actualizando metadata con datos del contrato...');
      baseMetadata.description = `A Gen${tokenData.generation} AdrianZero from the AdrianLAB collection`;
      baseMetadata.attributes = [
        { trait_type: "Body Type", value: `Gen${tokenData.generation}` },
        { trait_type: "Generation", value: tokenData.generation },
        { trait_type: "Mutation Level", value: tokenData.mutationLevelName || ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel] },
        { trait_type: "Can Replicate", value: tokenData.canReplicate ? "Yes" : "No" },
        { trait_type: "Has Been Modified", value: tokenData.hasBeenModified ? "Yes" : "No" },
        { trait_type: "Skin", value: `#${tokenData.skinId}` }
      ];

      // Añadir traits equipados como atributos
      console.log('[metadata] Añadiendo traits equipados...');
      if (tokenData.traits && tokenData.traits.length > 0) {
        tokenData.traits.forEach(trait => {
          baseMetadata.attributes.push({
            trait_type: trait.category,
            value: `#${trait.traitId}`
          });
        });
      }
      console.log('[metadata] Metadata final:', JSON.stringify(baseMetadata, null, 2));
    } catch (error) {
      console.error(`[metadata] Error obteniendo datos del token ${tokenId}:`, error);
      console.error('[metadata] Stack trace:', error.stack);
    }

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    return res.status(200).json(baseMetadata);
  } catch (error) {
    console.error('[metadata] Error general:', error);
    console.error('[metadata] Stack trace:', error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
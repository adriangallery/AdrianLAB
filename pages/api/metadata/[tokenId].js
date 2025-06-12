import { getRawTokenMetadata } from '../../../lib/blockchain.js';
import { getContracts } from '../../../lib/contracts.js';

export default async function handler(req, res) {
  const debug = {
    steps: [],
    errors: [],
    contracts: null,
    tokenData: null
  };

  try {
    const { tokenId } = req.query;
    debug.steps.push(`Iniciando request para token ${tokenId}`);
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      debug.errors.push(`Token ID inválido: ${tokenId}`);
      return res.status(400).json({ error: 'Invalid token ID', debug });
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
      debug.steps.push('Intentando conectar con los contratos...');
      const { extensions, core } = await getContracts();
      debug.contracts = {
        extensions: extensions.address,
        core: core.address
      };
      debug.steps.push('Contratos conectados correctamente');

      // Obtener datos del token
      debug.steps.push('Obteniendo datos del token...');
      const tokenData = await getRawTokenMetadata(tokenId);
      debug.tokenData = tokenData;
      debug.steps.push('Datos del token obtenidos correctamente');
      
      // Actualizar metadata con datos del contrato
      debug.steps.push('Actualizando metadata con datos del contrato...');
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
      debug.steps.push('Añadiendo traits equipados...');
      if (tokenData.traits && tokenData.traits.length > 0) {
        tokenData.traits.forEach(trait => {
          baseMetadata.attributes.push({
            trait_type: trait.category,
            value: `#${trait.traitId}`
          });
        });
      }
      debug.steps.push('Metadata final generada correctamente');
    } catch (error) {
      debug.errors.push({
        message: `Error obteniendo datos del token ${tokenId}`,
        error: error.message,
        stack: error.stack
      });
    }

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    return res.status(200).json({
      ...baseMetadata,
      debug: process.env.NODE_ENV === 'development' ? debug : undefined
    });
  } catch (error) {
    debug.errors.push({
      message: 'Error general',
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      debug: process.env.NODE_ENV === 'development' ? debug : undefined
    });
  }
}
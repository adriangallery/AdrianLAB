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
    const version = Date.now();

    // Metadata base que siempre se mostrará
    const baseMetadata = {
      name: `AdrianZero #${tokenId}`,
      description: `An AdrianZero from the AdrianLAB collection`,
      image: `${baseUrl}/api/render/${tokenId}.png?v=${version}`,
      external_url: `${baseUrl}/token/${tokenId}`,
      metadata_version: "2",
      attributes: []
    };
    
    try {
      // Test de conexión a contratos
      console.log('[metadata] Intentando conectar con los contratos...');
      const { core, traitsExtension } = await getContracts();
      console.log('[metadata] Contratos conectados:', {
        core: {
          address: core.address,
          functions: Object.keys(core.functions)
        },
        traitsExtension: {
          address: traitsExtension.address,
          functions: Object.keys(traitsExtension.functions)
        }
      });

      // Obtener datos del token
      console.log('[metadata] Llamando a getTokenData...');
      const tokenData = await core.getTokenData(tokenId);
      console.log('[metadata] Respuesta de getTokenData:', {
        result: tokenData.map(v => v.toString())
      });

      // Obtener traits equipados
      console.log('[metadata] Llamando a getAllEquippedTraits...');
      const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(tokenId);
      console.log('[metadata] Respuesta de getAllEquippedTraits:', {
        categories,
        traitIds: traitIds.map(id => id.toString())
      });

      // Añadir traits como atributos
      if (categories && categories.length > 0) {
        categories.forEach((category, index) => {
          baseMetadata.attributes.push({
            trait_type: category,
            value: `#${traitIds[index].toString()}`
          });
        });
      }

      // Añadir información de debug
      baseMetadata.debug = {
        contracts: {
          core: {
            address: core.address,
            functionCalled: 'getTokenData',
            result: tokenData.map(v => v.toString())
          },
          traitsExtension: {
            address: traitsExtension.address,
            functionCalled: 'getAllEquippedTraits',
            result: {
              categories,
              traitIds: traitIds.map(id => id.toString())
            }
          }
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[metadata] Error:', error);
      console.error('[metadata] Stack trace:', error.stack);
      
      baseMetadata.debug = {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
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
    
    return res.status(200).json({
      name: `AdrianZero #${req.query.tokenId || 'Unknown'}`,
      description: `An AdrianZero from the AdrianLAB collection (Error Mode)`,
      image: `https://adrianlab.vercel.app/api/render/${req.query.tokenId || 1}.png?v=${Date.now()}`,
      external_url: `https://adrianlab.vercel.app/token/${req.query.tokenId || 1}`,
      metadata_version: "2-error",
      attributes: [
        { trait_type: "Status", value: "Error Mode" },
        { trait_type: "Error", value: error.message }
      ],
      debug: {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
  }
}
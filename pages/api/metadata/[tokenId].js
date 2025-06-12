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

      // Obtener datos del token con timeout
      console.log('[metadata] Obteniendo datos del token...');
      
      // Implementar timeout para evitar que se cuelgue
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout al obtener datos del token')), 10000);
      });
      
      const tokenData = await Promise.race([
        getRawTokenMetadata(tokenId),
        timeoutPromise
      ]);
      
      console.log('[metadata] Datos del token obtenidos:', JSON.stringify(tokenData, null, 2));
      
      if (tokenData) {
        // Actualizar metadata con datos del contrato
        console.log('[metadata] Actualizando metadata con datos del contrato...');
        baseMetadata.description = `A Gen${tokenData.generation} AdrianZero from the AdrianLAB collection`;
        
        // Agregar atributos básicos siempre
        baseMetadata.attributes = [
          { trait_type: "Body Type", value: `Gen${tokenData.generation}` },
          { trait_type: "Generation", value: tokenData.generation },
          { trait_type: "Mutation Level", value: tokenData.mutationLevelName || ["None", "Mild", "Moderate", "Severe"][tokenData.mutationLevel] || "None" },
          { trait_type: "Can Replicate", value: tokenData.canReplicate ? "Yes" : "No" },
          { trait_type: "Has Been Modified", value: tokenData.hasBeenModified ? "Yes" : "No" },
          { trait_type: "Skin", value: `#${tokenData.skinId}` }
        ];

        // Añadir traits equipados como atributos
        console.log('[metadata] Añadiendo traits equipados...');
        if (tokenData.traits && Array.isArray(tokenData.traits) && tokenData.traits.length > 0) {
          console.log('[metadata] Traits encontrados:', tokenData.traits);
          tokenData.traits.forEach(trait => {
            if (trait && trait.category && trait.traitId) {
              baseMetadata.attributes.push({
                trait_type: trait.category,
                value: `#${trait.traitId}`
              });
              console.log('[metadata] Trait añadido:', trait.category, `#${trait.traitId}`);
            }
          });
        } else {
          console.log('[metadata] No se encontraron traits equipados');
        }
        
        console.log('[metadata] Metadata final con datos del contrato:', JSON.stringify(baseMetadata, null, 2));
      }
      
    } catch (contractError) {
      console.error(`[metadata] Error obteniendo datos del contrato para token ${tokenId}:`, contractError);
      console.error('[metadata] Stack trace:', contractError.stack);
      
      // Información más detallada del error
      if (contractError.message.includes('getTokenData is not a function')) {
        console.error('[metadata] ERROR CRÍTICO: La función getTokenData no existe en el ABI del contrato');
        console.error('[metadata] Verificar que el ABI de AdrianLabCore esté actualizado');
      }
      
      if (contractError.message.includes('getAllEquippedTraits is not a function')) {
        console.error('[metadata] ERROR CRÍTICO: La función getAllEquippedTraits no existe en el ABI del contrato');
        console.error('[metadata] Verificar que el ABI de AdrianTraitsExtensions esté actualizado');
      }
      
      // Continuar con metadata básica
      console.log('[metadata] Continuando con metadata básica debido a errores del contrato');
    }

    // Agregar información de debug en metadata
    if (process.env.NODE_ENV !== 'production') {
      baseMetadata.debug = {
        tokenDataObtained: tokenData !== null,
        contractError: tokenData === null,
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
    
    // Metadata de emergencia más completa
    const emergencyMetadata = {
      name: `AdrianZero #${req.query.tokenId || 'Unknown'}`,
      description: `An AdrianZero from the AdrianLAB collection (Emergency Mode)`,
      image: `https://adrianlab.vercel.app/api/render/${req.query.tokenId || 1}.png?v=${Date.now()}`,
      external_url: `https://adrianlab.vercel.app/token/${req.query.tokenId || 1}`,
      metadata_version: "2-emergency",
      attributes: [
        { trait_type: "Status", value: "Emergency Mode" },
        { trait_type: "Error", value: "Contract data unavailable" }
      ]
    };
    
    return res.status(200).json(emergencyMetadata);
  }
}
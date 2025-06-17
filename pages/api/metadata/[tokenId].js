import { getContracts } from '../../../lib/contracts.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    console.log(`[metadata] Iniciando request para token ${tokenId}`);
    
    // Caso especial para el token 100000
    if (tokenId === '100000' || tokenId === '100000.json') {
      const floppyPath = path.join(process.cwd(), 'public', 'metadata', 'floppy', '100000.json');
      const floppyData = JSON.parse(fs.readFileSync(floppyPath, 'utf8'));
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      return res.status(200).json(floppyData);
    }
    
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
      external_url: `${baseUrl}/api/render/${tokenId}.png?v=${version}`,
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

      // Obtener skin del token
      console.log('[metadata] Llamando a getTokenSkin...');
      const skinId = await core.getTokenSkin(tokenId);
      console.log('[metadata] Respuesta de getTokenSkin:', {
        skinId: skinId.toString()
      });

      // Obtener traits equipados
      console.log('[metadata] Llamando a getAllEquippedTraits...');
      const [categories, traitIds] = await traitsExtension.getAllEquippedTraits(tokenId);
      console.log('[metadata] Respuesta de getAllEquippedTraits:', {
        categories,
        traitIds: traitIds.map(id => id.toString())
      });

      // Añadir atributos base
      baseMetadata.attributes.push(
        {
          trait_type: "Generation",
          value: tokenData[0].toString()
        },
        {
          trait_type: "Skin",
          value: `#${skinId.toString()}`
        }
      );

      // Añadir atributos de mutación si está mutado
      if (tokenData[2]) { // isMutated
        baseMetadata.attributes.push(
          {
            trait_type: "Mutation Level",
            value: tokenData[1].toString()
          },
          {
            trait_type: "Mutation Type",
            value: tokenData[3].toString()
          },
          {
            trait_type: "Mutation Stage",
            value: tokenData[4].toString()
          }
        );
      }

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
            functions: {
              getTokenData: {
                called: true,
                result: tokenData.map(v => v.toString())
              },
              getTokenSkin: {
                called: true,
                result: skinId.toString()
              }
            }
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
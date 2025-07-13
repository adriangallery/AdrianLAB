import { getContracts } from '../../../lib/contracts.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Configurar CORS - Permitir múltiples orígenes
  const allowedOrigins = [
    'https://adrianpunks.com',
    'https://opensea.io',
    'https://testnets.opensea.io',
    'https://rarible.com',
    'https://looksrare.org',
    'https://x2y2.io',
    'https://blur.io',
    'https://magiceden.io',
    'https://sudoswap.xyz',
    'https://reservoir.tools',
    'https://nftx.io',
    'https://element.market',
    'https://tensor.trade',
    'https://okx.com',
    'https://binance.com',
    'https://coinbase.com'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Para requests sin origin (como imágenes directas) o orígenes no listados
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { tokenId } = req.query;
    console.log(`[metadata] Iniciando request para token ${tokenId}`);
    
    // Caso especial para el token 100000
    if (tokenId === '100000' || tokenId === '100000.json') {
      const metadataPath = path.join(process.cwd(), 'public', 'metadata', '100000.json');
      const metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      return res.status(200).json(metadataData);
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
      status: "DEPOSITED", // Campo por defecto
      profileName: "Zombie Outbreak", // Campo por defecto
      attributes: []
    };
    
    try {
      // Test de conexión a contratos
      console.log('[metadata] Intentando conectar con los contratos...');
      const { core, traitsExtension, patientZero } = await getContracts();
      console.log('[metadata] Contratos conectados:', {
        core: {
          address: core.address,
          functions: Object.keys(core.functions)
        },
        traitsExtension: {
          address: traitsExtension.address,
          functions: Object.keys(traitsExtension.functions)
        },
        patientZero: {
          address: patientZero.address,
          functions: Object.keys(patientZero.functions)
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

      // NUEVO: Obtener status del token desde PatientZERO
      try {
        console.log('[metadata] Llamando a getTokenStatus desde PatientZERO...');
        const tokenStatus = await patientZero.getTokenStatus(tokenId);
        console.log('[metadata] Respuesta de getTokenStatus:', {
          status: tokenStatus[0],
          profileId: tokenStatus[1].toString()
        });
        
        // tokenStatus[0] = status, tokenStatus[1] = profileId
        const status = tokenStatus[0];
        const profileId = tokenStatus[1];
        
        // Actualizar status en metadata
        baseMetadata.status = status;
        
        // NUEVO: Obtener profileName si profileId > 0
        if (parseInt(profileId) > 0) {
          try {
            console.log('[metadata] Llamando a profiles desde PatientZERO...');
            const profileData = await patientZero.profiles(profileId);
            console.log('[metadata] Respuesta de profiles:', {
              profileName: profileData[0],
              traitIds: profileData[1].map(id => id.toString()),
              reward: profileData[2].toString(),
              active: profileData[3],
              recovered: profileData[4].toString(),
              checkGeneration: profileData[5],
              requiredGeneration: profileData[6].toString(),
              checkSkin: profileData[7],
              requiredSkin: profileData[8]
            });
            
            // profile[0] = profileName
            const profileName = profileData[0];
            baseMetadata.profileName = profileName;
            
          } catch (error) {
            console.error('[metadata] Error obteniendo profile:', error);
            // Mantener valor por defecto
          }
        }
        
      } catch (error) {
        console.error('[metadata] Error obteniendo token status:', error);
        // Mantener valores por defecto
      }

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
          },
          patientZero: {
            address: patientZero.address,
            functions: {
              getTokenStatus: {
                called: true,
                result: {
                  status: baseMetadata.status,
                  profileName: baseMetadata.profileName
                }
              }
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
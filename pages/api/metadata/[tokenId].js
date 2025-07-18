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
      animation_url: `${baseUrl}/labimages/10000.gif`,
      metadata_version: "2",
      attributes: []
    };
    
    try {
      // Test de conexión a contratos
      console.log('[metadata] Intentando conectar con los contratos...');
      const { core, traitsExtension, patientZero, serumModule, adrianNameRegistry } = await getContracts();
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
        },
        serumModule: {
          address: serumModule.address,
          functions: Object.keys(serumModule.functions)
        },
        adrianNameRegistry: {
          address: adrianNameRegistry.address,
          functions: Object.keys(adrianNameRegistry.functions)
        }
      });

      // Obtener status y profileName desde PatientZERO
      try {
        console.log('[metadata] Llamando a getTokenStatus desde PatientZERO...');
        const tokenStatus = await patientZero.getTokenStatus(tokenId);
        const status = tokenStatus[0];
        const profileId = tokenStatus[1];
        if (status) baseMetadata.status = status;
        if (parseInt(profileId.toString()) > 0) {
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
            
            const profileName = profileData[0];
            if (profileName) baseMetadata.profileName = profileName;
          } catch (error) {
            console.error('[metadata] Error obteniendo profile:', error);
          }
        }
      } catch (error) {
        console.log('[metadata] Token no ha pasado por PatientZERO o error en read:', error.message);
      }

      // Obtener historial de nombres desde AdrianNameRegistry
      try {
        console.log('[metadata] Llamando a getTokenNameHistory desde AdrianNameRegistry...');
        const nameHistory = await adrianNameRegistry.getTokenNameHistory(tokenId);
        console.log('[metadata] Respuesta de getTokenNameHistory:', {
          history: nameHistory.map(change => ({
            name: change[0],
            changer: change[1],
            timestamp: change[2].toString(),
            paidChange: change[3]
          }))
        });
        
        // Si hay cambios de nombre en el historial, usar el último nombre
        if (nameHistory && nameHistory.length > 0) {
          const lastNameChange = nameHistory[nameHistory.length - 1]; // Último cambio de nombre
          const customName = lastNameChange[0]; // El nombre personalizado
          
          // Modificar el nombre del metadata
          baseMetadata.name = `${customName} #${tokenId}`;
          console.log(`[metadata] Nombre personalizado aplicado: ${baseMetadata.name}`);
        }
        
      } catch (error) {
        console.log('[metadata] Error obteniendo historial de nombres:', error.message);
      }

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

      // Función para determinar qué archivo de metadata cargar según el token ID
      const getMetadataFileForToken = (tokenId) => {
        const numTokenId = parseInt(tokenId);
        
        if (numTokenId >= 10000 && numTokenId <= 10002) {
          return 'floppy.json';
        } else if (numTokenId >= 15000 && numTokenId <= 15006) {
          return 'pagers.json';
        } else if (numTokenId === 262144) {
          return 'serums.json';
        } else {
          return 'traits.json';
        }
      };

      // Función para cargar metadata del archivo correcto
      const loadMetadataForToken = (tokenId) => {
        try {
          const metadataFile = getMetadataFileForToken(tokenId);
          const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', metadataFile);
          
          console.log(`[metadata] Cargando metadata desde: ${metadataFile} para token ${tokenId}`);
          
          const metadataBuffer = fs.readFileSync(metadataPath);
          const metadata = JSON.parse(metadataBuffer.toString());
          
          // Determinar qué array usar según el archivo
          let traitsArray;
          switch (metadataFile) {
            case 'floppy.json':
              traitsArray = metadata.floppys;
              break;
            case 'pagers.json':
              traitsArray = metadata.pagers;
              break;
            case 'serums.json':
              traitsArray = metadata.serums;
              break;
            default:
              traitsArray = metadata.traits;
          }
          
          return traitsArray;
        } catch (error) {
          console.error(`[metadata] Error cargando metadata para token ${tokenId}:`, error.message);
          return [];
        }
      };

      // Cargar datos de metadata según el token
      console.log('[metadata] Cargando datos de metadata...');
      let traitsData;
      try {
        const traitsArray = loadMetadataForToken(tokenId);
        traitsData = { traits: traitsArray };
        console.log(`[metadata] Metadata cargado: ${traitsArray.length} items encontrados`);
      } catch (error) {
        console.error('[metadata] Error cargando metadata:', error);
        traitsData = { traits: [] };
      }

      // Función para obtener nombre del trait por ID
      const getTraitName = (traitId) => {
        const trait = traitsData.traits.find(t => t.tokenId === parseInt(traitId));
        return trait ? trait.name : `#${traitId}`;
      };

      // Obtener historial de serums desde SerumModule
      try {
        console.log('[metadata] Llamando a getTokenSerumHistory desde SerumModule...');
        const serumHistory = await serumModule.getTokenSerumHistory(tokenId);
        console.log('[metadata] Respuesta de getTokenSerumHistory:', {
          history: serumHistory.map(serum => ({
            serumId: serum[0].toString(),
            success: serum[1],
            timestamp: serum[2].toString(),
            mutation: serum[3]
          }))
        });
        
        // Si hay serums en el historial, agregar el último como atributo
        if (serumHistory && serumHistory.length > 0) {
          const lastSerum = serumHistory[serumHistory.length - 1]; // Último serum aplicado
          const serumSuccess = lastSerum[1];
          const serumMutation = lastSerum[3];
          
          let usedSerumValue;
          if (serumSuccess) {
            usedSerumValue = serumMutation; // "AdrianGF"
          } else {
            usedSerumValue = "FAILED";
          }
          
          baseMetadata.attributes.push({
            trait_type: "UsedSerum",
            value: usedSerumValue
          });
        }
        
      } catch (error) {
        console.log('[metadata] Error obteniendo historial de serums:', error.message);
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

      // Añadir traits como atributos con nombres
      if (categories && categories.length > 0) {
        categories.forEach((category, index) => {
          const traitId = traitIds[index].toString();
          const traitName = getTraitName(traitId);
          baseMetadata.attributes.push({
            trait_type: category,
            value: traitName
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
              traitIds: traitIds.map(id => id.toString()),
              traitNames: categories.map((category, index) => ({
                category,
                traitId: traitIds[index].toString(),
                traitName: getTraitName(traitIds[index].toString())
              }))
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
          },
          serumModule: {
            address: serumModule.address,
            functions: {
              getTokenSerumHistory: {
                called: true,
                result: baseMetadata.attributes.find(attr => attr.trait_type === "UsedSerum") ? 
                  baseMetadata.attributes.find(attr => attr.trait_type === "UsedSerum").value : "No serums found"
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
// API endpoint for rendering custom tokens with modified traits
import { createCanvas, loadImage } from 'canvas';
import { getContracts } from '../../../../lib/contracts.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { getCachedJson, setCachedJson } from '../../../../lib/json-cache.js';
import { getCachedSvgPng, setCachedSvgPng } from '../../../../lib/svg-png-cache.js';
import { getCachedComponent, setCachedComponent } from '../../../../lib/component-cache.js';

// Función para normalizar categorías a mayúsculas
const normalizeCategory = (category) => {
  // Todas las categorías ya están en mayúsculas en traits.json
  // Solo mantener el mapeo PACKS->SWAG para compatibilidad con el contrato
  const categoryMap = {
    'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
  };
  
  const normalized = categoryMap[category] || category;
  return normalized;
};

// NUEVA FUNCIÓN: Cargar trait desde URL externa para tokens 30000-35000
const loadExternalTrait = async (traitId) => {
  try {
    const externalUrl = `https://adrianzero.com/designs/${traitId}.svg`;
    console.log(`[custom-render] 🌐 LÓGICA EXTERNA: Cargando trait ${traitId} desde URL externa: ${externalUrl}`);
    
    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    console.log(`[custom-render] 🌐 LÓGICA EXTERNA: SVG descargado desde URL externa, tamaño: ${svgBuffer.byteLength} bytes`);
    
    // Renderizar SVG a PNG
    const resvg = new Resvg(Buffer.from(svgBuffer), {
      fitTo: {
        mode: 'width',
        value: 1000
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    console.log(`[custom-render] 🌐 LÓGICA EXTERNA: PNG generado desde URL externa, tamaño: ${pngBuffer.length} bytes`);
    
    const image = await loadImage(pngBuffer);
    console.log(`[custom-render] 🌐 LÓGICA EXTERNA: Trait ${traitId} cargado exitosamente desde URL externa`);
    return image;
  } catch (error) {
    console.error(`[custom-render] 🌐 LÓGICA EXTERNA: Error cargando trait ${traitId} desde URL externa:`, error.message);
    console.error(`[custom-render] 🌐 LÓGICA EXTERNA: Stack trace:`, error.stack);
    return null;
  }
};

// NUEVA FUNCIÓN: Extraer traitId de un path
const extractTraitIdFromPath = (path) => {
  try {
    // Extraer el número del final del path (antes de .svg)
    const match = path.match(/(\d+)\.svg$/);
    if (match) {
      const traitId = parseInt(match[1]);
      return traitId;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// NUEVA FUNCIÓN: Verificar si un traitId está en el rango externo
const isExternalTrait = (traitId) => {
  return traitId >= 30000 && traitId <= 35000;
};

// LÓGICA ESPECIAL: Mapear ciertos tokens de HEAD a HAIR (solo peinados reales, no accesorios)
const HEAD_TO_HAIR_TOKENS = [
  14, 17, 18, 19, 21, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 188, 190, 198, 199, 203, 204, 207, 218, 219, 226, 236
];

// Función para verificar si un token debe renderizarse como HAIR
const shouldRenderAsHair = (traitId) => {
  return HEAD_TO_HAIR_TOKENS.includes(parseInt(traitId));
};

// =============================================
// SECCIÓN DE MAPEO DE TRAITS
// =============================================

// Función para determinar qué archivo de metadata cargar según el token ID
const getMetadataFileForToken = (tokenId) => {
  const numTokenId = parseInt(tokenId);
  
  if (numTokenId >= 10000 && numTokenId <= 10002) {
    return 'floppy.json';
  } else if (numTokenId >= 15000 && numTokenId <= 15006) {
    return 'pagers.json';
  } else if (numTokenId === 262144) {
    return 'serums.json';
  } else if (numTokenId >= 30000 && numTokenId <= 35000) {
    return 'studio.json';
  } else if ((numTokenId >= 100001 && numTokenId <= 101003) || (numTokenId >= 101001 && numTokenId <= 101003)) {
    return 'ogpunks.json';
  } else {
    return 'traits.json';
  }
};

// Función para cargar metadata del archivo correcto
const loadMetadataForToken = async (tokenId) => {
  try {
    const metadataFile = getMetadataFileForToken(tokenId);
    
    // Intentar obtener del caché primero
    const cachedData = await getCachedJson(metadataFile);
    if (cachedData) {
      return cachedData;
    }
    
    const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', metadataFile);
    
    console.log(`[custom-render] Cargando metadata desde: ${metadataFile} para token ${tokenId}`);
    
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
      case 'studio.json':
        // Para studio.json, convertir el objeto a array
        traitsArray = Object.entries(metadata).map(([tokenId, trait]) => ({
          tokenId: tokenId,
          category: trait.category,
          name: trait.name,
          fileName: `${tokenId}.svg`
        }));
        break;
      case 'ogpunks.json':
        traitsArray = metadata.traits;
        break;
      default:
        traitsArray = metadata.traits;
    }
    
    // Guardar en caché
    setCachedJson(metadataFile, traitsArray);
    
    return traitsArray;
  } catch (error) {
    console.error(`[custom-render] Error cargando metadata para token ${tokenId}:`, error.message);
    return [];
  }
};

// Función para cargar el mapeo de traits desde el JSON correcto según el token
const loadTraitsMapping = async (tokenId) => {
  try {
    const traitsArray = await loadMetadataForToken(tokenId);
    
    const mapping = {};
    traitsArray.forEach(trait => {
      // Validar que trait y trait.category existan antes de usar toUpperCase()
      if (trait && trait.category) {
        mapping[trait.tokenId] = {
          category: trait.category.toUpperCase(),
          name: trait.name || `Trait #${trait.tokenId}`,
          fileName: trait.fileName || `${trait.tokenId}.svg`
        };
      } else {
        console.warn(`[custom-render] Trait ${trait?.tokenId} sin categoría, asignando 'UNKNOWN'`);
        mapping[trait.tokenId] = {
          category: 'UNKNOWN',
          name: trait?.name || `Trait #${trait.tokenId}`,
          fileName: trait?.fileName || `${trait.tokenId}.svg`
        };
      }
    });
    
    return mapping;
  } catch (error) {
    console.error('[custom-render] Error cargando mapeo de traits:', error);
    return {};
  }
};

// NUEVA FUNCIÓN: Cargar mapeo combinado de traits (traits.json + studio.json para tokens 30000+)
const loadCombinedTraitsMapping = async (tokenId) => {
  try {
    console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Iniciando carga de mapeo combinado para token ${tokenId}`);
    
    // Cargar mapeo base desde traits.json
    const baseTraitsArray = await loadMetadataForToken(tokenId);
    const baseMapping = {};
    baseTraitsArray.forEach(trait => {
      // Validar que trait y trait.category existan antes de usar toUpperCase()
      if (trait && trait.category) {
        baseMapping[trait.tokenId] = {
          category: trait.category.toUpperCase(),
          name: trait.name || `Trait #${trait.tokenId}`,
          fileName: trait.fileName || `${trait.tokenId}.svg`
        };
      } else {
        console.warn(`[custom-render] 🔄 LÓGICA COMBINADA: Trait ${trait?.tokenId} sin categoría, asignando 'UNKNOWN'`);
        baseMapping[trait.tokenId] = {
          category: 'UNKNOWN',
          name: trait?.name || `Trait #${trait.tokenId}`,
          fileName: trait?.fileName || `${trait.tokenId}.svg`
        };
      }
    });
    
    console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Mapeo base cargado con ${Object.keys(baseMapping).length} entries`);
    
    // CARGAR SIEMPRE studio.json para traits externos (disponibles para todos los tokens)
    console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Cargando studio.json para traits externos`);
    try {
      // Intentar obtener del caché primero
      const cachedStudioData = await getCachedJson('studio.json');
      if (cachedStudioData) {
        console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Studio.json cargado desde caché con ${Object.keys(cachedStudioData).length} entries`);
        
        // Combinar studio.json con el mapeo base
        Object.entries(cachedStudioData).forEach(([traitId, trait]) => {
          // Validar que trait y trait.category existan antes de usar toUpperCase()
          if (trait && trait.category) {
            baseMapping[traitId] = {
              category: trait.category.toUpperCase(),
              name: trait.name || `Studio Trait #${traitId}`,
              fileName: `${traitId}.svg`, // Los traits de studio usan su ID como nombre de archivo
              external_url: trait.external_url, // Añadir URL externa para referencia
              isExternal: true // Marcar como trait externo
            };
          } else {
            console.warn(`[custom-render] 🔄 LÓGICA COMBINADA: Studio trait ${traitId} sin categoría, asignando 'UNKNOWN'`);
            baseMapping[traitId] = {
              category: 'UNKNOWN',
              name: trait?.name || `Studio Trait #${traitId}`,
              fileName: `${traitId}.svg`,
              external_url: trait?.external_url,
              isExternal: true
            };
          }
        });
      } else {
        const studioPath = path.join(process.cwd(), 'public', 'labmetadata', 'studio.json');
        const studioBuffer = fs.readFileSync(studioPath);
        const studioData = JSON.parse(studioBuffer.toString());
        
        console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Studio.json cargado con ${Object.keys(studioData).length} entries`);
        
        // Guardar en caché
        setCachedJson('studio.json', studioData);
        
        // Combinar studio.json con el mapeo base
        Object.entries(studioData).forEach(([traitId, trait]) => {
          // Validar que trait y trait.category existan antes de usar toUpperCase()
          if (trait && trait.category) {
            baseMapping[traitId] = {
              category: trait.category.toUpperCase(),
              name: trait.name || `Studio Trait #${traitId}`,
              fileName: `${traitId}.svg`, // Los traits de studio usan su ID como nombre de archivo
              external_url: trait.external_url, // Añadir URL externa para referencia
              isExternal: true // Marcar como trait externo
            };
          } else {
            console.warn(`[custom-render] 🔄 LÓGICA COMBINADA: Studio trait ${traitId} sin categoría, asignando 'UNKNOWN'`);
            baseMapping[traitId] = {
              category: 'UNKNOWN',
              name: trait?.name || `Studio Trait #${traitId}`,
              fileName: `${traitId}.svg`,
              external_url: trait?.external_url,
              isExternal: true
            };
          }
        });
      }
 
      // CARGAR SIEMPRE ogpunks.json para traits OGPUNKS (100001-101003)
      console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Cargando ogpunks.json para traits OGPUNKS`);
      const cachedOgpunks = await getCachedJson('ogpunks.json');
      if (cachedOgpunks) {
        console.log(`[custom-render] 🔄 LÓGICA COMBINADA: ogpunks.json cargado desde caché con ${cachedOgpunks.length} entries`);
        cachedOgpunks.forEach(trait => {
          const traitId = trait.tokenId;
          // Validar que trait y trait.category existan antes de usar toUpperCase()
          if (trait && trait.category) {
            baseMapping[traitId] = {
              category: trait.category.toUpperCase(),
              name: trait.name || `OGPunk Trait #${traitId}`,
              fileName: `${traitId}.svg`,
              isOgpunk: true
            };
          } else {
            console.warn(`[custom-render] 🔄 LÓGICA COMBINADA: OGPunk trait ${traitId} sin categoría, asignando 'TOP'`);
            baseMapping[traitId] = {
              category: 'TOP',
              name: trait?.name || `OGPunk Trait #${traitId}`,
              fileName: `${traitId}.svg`,
              isOgpunk: true
            };
          }
        });
      } else {
        const ogpunksPath = path.join(process.cwd(), 'public', 'labmetadata', 'ogpunks.json');
        try {
          const ogpunksBuffer = fs.readFileSync(ogpunksPath);
          const ogpunksData = JSON.parse(ogpunksBuffer.toString());
          const ogTraits = ogpunksData.traits || [];
          console.log(`[custom-render] 🔄 LÓGICA COMBINADA: ogpunks.json cargado con ${ogTraits.length} entries`);
          // Guardar en caché como array directo para consistencia con getCachedJson
          setCachedJson('ogpunks.json', ogTraits);
          ogTraits.forEach(trait => {
            const traitId = trait.tokenId;
            // Validar que trait y trait.category existan antes de usar toUpperCase()
            if (trait && trait.category) {
              baseMapping[traitId] = {
                category: trait.category.toUpperCase(),
                name: trait.name || `OGPunk Trait #${traitId}`,
                fileName: `${traitId}.svg`,
                isOgpunk: true
              };
            } else {
              console.warn(`[custom-render] 🔄 LÓGICA COMBINADA: OGPunk trait ${traitId} sin categoría, asignando 'TOP'`);
              baseMapping[traitId] = {
                category: 'TOP',
                name: trait?.name || `OGPunk Trait #${traitId}`,
                fileName: `${traitId}.svg`,
                isOgpunk: true
              };
            }
          });
        } catch (err) {
          console.error(`[custom-render] 🔄 LÓGICA COMBINADA: Error cargando ogpunks.json:`, err.message);
        }
      }

      console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Mapeo combinado completado con ${Object.keys(baseMapping).length} entries totales`);
      
      // Debug: Mostrar algunos traits externos cargados
      const externalTraits = Object.entries(baseMapping).filter(([id, trait]) => trait.isExternal);
      console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Traits externos cargados:`, externalTraits.slice(0, 5).map(([id, trait]) => `${id}: ${trait.name} (${trait.category})`));
      
    } catch (error) {
      console.error(`[custom-render] 🔄 LÓGICA COMBINADA: Error cargando studio.json:`, error.message);
      console.log(`[custom-render] 🔄 LÓGICA COMBINADA: Continuando solo con mapeo base`);
    }
  
  return baseMapping;
  } catch (error) {
    console.error('[custom-render] 🔄 LÓGICA COMBINADA: Error cargando mapeo combinado:', error);
    return {};
  }
};

// =============================================
// SECCIÓN DE EXCEPCIONES ESPECIALES
// =============================================

// Mapeo de excepciones para traits de skin
const SKIN_TRAIT_EXCEPTIONS = {
  // Trait ID 37 (Normal)
  37: {
    GEN0: 'SKIN/OG_GEN0.svg',
    GEN1: 'SKIN/OG_GEN1.svg',
    GEN2: 'SKIN/OG_GEN2.svg'
  },
  // Trait ID 38 (3D)
  38: {
    GEN0: 'SKIN/OG_GEN0_3D.svg',
    GEN1: 'SKIN/OG_GEN1_3D.svg',
    GEN2: 'SKIN/OG_GEN2_3D.svg'
  }
};

// Función para verificar si un trait es una excepción de skin
const isSkinTraitException = (traitId) => {
  return traitId in SKIN_TRAIT_EXCEPTIONS;
};

// Función para obtener la ruta del skin excepcional
const getSkinTraitPath = (traitId, generation) => {
  if (!isSkinTraitException(traitId)) return null;
  return SKIN_TRAIT_EXCEPTIONS[traitId][`GEN${generation}`];
};

// =============================================
// FUNCIÓN PRINCIPAL
// =============================================

export default async function handler(req, res) {
  // Configurar CORS - Permitir múltiples orígenes
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com',
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

  // Manejar preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extraer tokenId de la ruta, eliminando .png si existe
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    console.log(`[custom-render] Iniciando renderizado personalizado para token ${cleanTokenId}`);

    // Verify that tokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[custom-render] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // DETECCIÓN TEMPRANA DE TRAITS EXTERNOS
    console.log(`[custom-render] 🔍 DETECCIÓN TEMPRANA: Analizando token ${cleanTokenId} para traits externos`);
    const numTokenId = parseInt(cleanTokenId);
    const isExternalToken = numTokenId >= 30000 && numTokenId <= 35000;
    
    if (isExternalToken) {
      console.log(`[custom-render] 🔍 DETECCIÓN TEMPRANA: Token ${cleanTokenId} detectado en rango externo (30000-35000)`);
    } else {
      console.log(`[custom-render] 🔍 DETECCIÓN TEMPRANA: Token ${cleanTokenId} fuera del rango externo, usando lógica normal`);
    }

    // Cargar mapeo de traits (combinado si es necesario)
    const traitsMapping = await loadCombinedTraitsMapping(cleanTokenId);
    console.log(`[custom-render] Mapeo de traits cargado con ${Object.keys(traitsMapping).length} entries`);

    // Obtener parámetros de query para traits personalizados
    const customTraits = {};
    
    // Procesar parámetros de categorías directas primero
    Object.keys(req.query).forEach(key => {
      if (key !== 'tokenId' && key !== 'png' && key !== 'trait') {
        const traitValue = req.query[key];
        const traitId = parseInt(traitValue);
        if (!isNaN(traitId)) {
          customTraits[key.toUpperCase()] = traitId.toString();
          console.log(`[custom-render] Categoría ${key.toUpperCase()} = ${traitId}`);
        }
      }
    });
    
    // Procesar parámetros "trait" (pueden ser múltiples)
    if (req.query.trait) {
      // Manejar tanto arrays como valores únicos
      const traitValues = Array.isArray(req.query.trait) ? req.query.trait : [req.query.trait];
      
      // Crear un mapa temporal para detectar conflictos de categoría
      const categoryConflicts = {};
      
      traitValues.forEach(traitValue => {
        const traitId = parseInt(traitValue);
        if (!isNaN(traitId) && traitsMapping[traitId]) {
          const category = traitsMapping[traitId].category;
          const traitInfo = traitsMapping[traitId];
          
          // Registrar el trait para esta categoría
          if (!categoryConflicts[category]) {
            categoryConflicts[category] = [];
          }
          categoryConflicts[category].push({
            id: traitId,
            name: traitInfo.name,
            fileName: traitInfo.fileName,
            isExternal: traitInfo.isExternal || false
          });
          
          // Debug mejorado para traits externos
          if (traitInfo.isExternal) {
            console.log(`[custom-render] 🌐 TRAIT EXTERNO: Trait ID ${traitId} (${traitInfo.name}) mapeado a categoría ${category} - URL: ${traitInfo.external_url}`);
          } else {
            console.log(`[custom-render] Trait ID ${traitId} (${traitInfo.name}) mapeado a categoría ${category}`);
          }
        } else {
          console.warn(`[custom-render] Trait ID ${traitId} no encontrado en el mapeo combinado`);
        }
      });
      
      // Resolver conflictos: usar solo el último trait de cada categoría
      Object.keys(categoryConflicts).forEach(category => {
        const traits = categoryConflicts[category];
        if (traits.length > 1) {
          console.log(`[custom-render] ⚠️  Conflicto detectado en categoría ${category}:`);
          traits.forEach((trait, index) => {
            const status = index === traits.length - 1 ? '✅ SELECCIONADO' : '❌ DESCARTADO';
            const externalFlag = trait.isExternal ? '🌐 EXTERNO' : '';
            console.log(`[custom-render]   ${status} - Trait ${trait.id} (${trait.name}) ${externalFlag}`);
          });
        }
        
        // Usar solo el último trait de la categoría
        const lastTrait = traits[traits.length - 1];
        customTraits[category] = lastTrait.id.toString();
        
        // Debug mejorado para traits externos
        if (lastTrait.isExternal) {
          console.log(`[custom-render] 🌐 FINAL EXTERNO: Categoría ${category} = Trait ${lastTrait.id} (${lastTrait.name}) - EXTERNO`);
        } else {
          console.log(`[custom-render] Final: Categoría ${category} = Trait ${lastTrait.id} (${lastTrait.name})`);
        }
      });
    }

    console.log(`[custom-render] Traits personalizados:`, customTraits);

    // Conectar con los contratos
    console.log('[custom-render] Conectando con los contratos...');
    const { core, traitsExtension, patientZero, serumModule } = await getContracts();

    // Obtener datos del token
    console.log('[custom-render] Obteniendo datos del token...');
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    
    console.log('[custom-render] TokenData:', {
      generation: generation.toString(),
      mutationLevel: mutationLevel.toString(),
      canReplicate,
      hasBeenModified
    });

    // LÓGICA ESPECIAL PARA TRAITLAB: Detectar serum ADRIANGF y cambiar token base
    let baseTokenId = cleanTokenId;
    let appliedSerumForBase = null;
    
    try {
      console.log('[custom-render] Verificando si hay serum aplicado para determinar token base...');
      const serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        const lastSerum = serumHistory[serumHistory.length - 1];
        const serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        // Verificar si hay un AdrianGF previo en el historial
        for (const serum of serumHistory) {
          if (serum[1] === true && serum[3] === "AdrianGF") {
            hasAdrianGFSerum = true;
            console.log(`[custom-render] AdrianGF previo detectado en historial`);
            break;
          }
        }
        
        // LÓGICA CORREGIDA: GoldenAdrian prevalece sobre AdrianGF
        // - Serum exitoso: success = true Y mutation tiene valor
        // - Serum fallido: success = false (independientemente del valor de mutation)
        if (serumSuccess) {
          // Serum exitoso
          if (serumMutation) {
            appliedSerumForBase = serumMutation;
            console.log(`[custom-render] Serum exitoso detectado: ${appliedSerumForBase}`);
          } else {
            console.warn(`[custom-render] Serum marcado como exitoso pero sin mutación, esto no debería pasar`);
          }
        } else {
          // Serum fallido (consistente con metadata: "FAILED")
          serumFailed = true;
          // Determinar qué serum falló basándose en el historial completo
          if (serumMutation) {
            appliedSerumForBase = serumMutation;
          } else {
            // Si no hay mutation, buscar en el historial completo
            for (let i = serumHistory.length - 1; i >= 0; i--) {
              const serum = serumHistory[i];
              if (serum[3] && (serum[3] === "AdrianGF" || serum[3] === "GoldenAdrian")) {
                appliedSerumForBase = serum[3];
                break;
              }
            }
          }
          console.log(`[custom-render] Serum fallido detectado: ${appliedSerumForBase || 'desconocido'} (será "FAILED" en metadata)`);
        }
      }
    } catch (error) {
      console.log('[custom-render] Error verificando serum para token base:', error.message);
    }
    
    console.log(`[custom-render] Token base final: ${baseTokenId} (original: ${cleanTokenId})`);

    // Obtener skin del token base
    console.log('[custom-render] Obteniendo skin del token base...');
    const tokenSkinData = await core.getTokenSkin(baseTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log('[custom-render] Skin info:', {
      skinId,
      skinName
    });

    // Obtener traits equipados actuales del token original (no del base)
    console.log('[custom-render] Obteniendo traits equipados actuales del token original...');
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    // Crear mapa de traits actuales
    const currentTraits = {};
    categories.forEach((category, index) => {
      const normalizedCategory = normalizeCategory(category);
      const traitId = traitIds[index].toString();
      
      // LÓGICA ESPECIAL: Si es HEAD y está en la lista de tokens que deben ser HAIR
      if (normalizedCategory === 'HEAD' && shouldRenderAsHair(traitId)) {
        console.log(`[custom-render] LÓGICA ESPECIAL: Token ${traitId} (${normalizedCategory}) será renderizado como HAIR`);
        currentTraits['HAIR'] = traitId;
      } else {
        currentTraits[normalizedCategory] = traitId;
      }
    });

    console.log('[custom-render] Traits actuales:', currentTraits);

    // Aplicar traits personalizados (sustituir los especificados)
    // Normalizar categorías en traits personalizados
    const normalizedCustomTraits = {};
    Object.entries(customTraits).forEach(([category, traitId]) => {
      normalizedCustomTraits[normalizeCategory(category)] = traitId;
    });
    
    const finalTraits = { ...currentTraits, ...normalizedCustomTraits };
    console.log('[custom-render] Traits finales (con modificaciones):', finalTraits);

    // Generar PNG estático (eliminada lógica de animaciones)
    console.log('[custom-render] Generando PNG estático...');

    // Crear canvas con fondo blanco
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    console.log('[custom-render] Canvas creado con fondo blanco');

    // Función para cargar y renderizar SVG con caché
    const loadAndRenderSvg = async (path) => {
      // LÓGICA ESPECIAL: Verificar si el path contiene un traitId en rango externo
      const traitId = extractTraitIdFromPath(path);
      if (traitId && isExternalTrait(traitId)) {
        console.log(`[custom-render] 🌐 LÓGICA EXTERNA: Path ${path} contiene trait ${traitId} en rango externo, usando carga externa`);
        return await loadExternalTrait(traitId);
      }
      
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/traits/${path}`;
        console.log(`[custom-render] Cargando imagen: ${imageUrl}`);

        let response = await fetch(imageUrl);
        if (!response.ok) {
          // Fallback: si el nombre del archivo es numérico (e.g., BACKGROUND/663.svg), intentar en /labimages/<id>.svg
          const filename = path.split('/').pop() || '';
          const numericId = filename.replace(/\.svg$/i, '');
          if (/^\d+$/.test(numericId)) {
            const fallbackUrl = `${baseUrl}/labimages/${numericId}.svg`;
            console.log(`[custom-render] Fallback labimages: ${fallbackUrl}`);
            const fbResp = await fetch(fallbackUrl);
            if (!fbResp.ok) {
              throw new Error(`HTTP error! status: ${response.status} | fallback: ${fbResp.status}`);
            }
            response = fbResp;
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }
        
        const svgBuffer = await response.arrayBuffer();
        const svgContent = Buffer.from(svgBuffer);
        
        // Intentar obtener del caché SVG→PNG primero
        const cachedPng = getCachedSvgPng(svgContent.toString());
        if (cachedPng) {
          return loadImage(cachedPng);
        }
        
        // Si no está en caché, hacer la conversión
        const resvg = new Resvg(svgContent, {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        
        // Guardar en caché SVG→PNG
        setCachedSvgPng(svgContent.toString(), pngBuffer);
        
        return loadImage(pngBuffer);
      } catch (error) {
        console.error(`[custom-render] Error cargando SVG ${path}:`, error.message);
        return null;
      }
    };

    // Función específica para cargar archivos ADRIAN desde sistema de archivos con caché
    const loadAdrianSvg = async (serumName, generation, skinType) => {
      try {
        // LÓGICA ESPECIAL PARA ADRIANGF: Usar estructura de carpetas específica
        if (serumName === "AdrianGF") {
          console.log(`[custom-render] 🧬 LÓGICA ESPECIAL: Cargando skin ADRIANGF para GEN${generation}, skin ${skinType}`);
          
          // Mapear skinType a formato de archivo
          let skinFileName;
          if (skinType === "Albino") {
            skinFileName = `GEN${generation}_Albino.svg`;
          } else if (skinType === "Alien") {
            skinFileName = `GF${generation}_Alien.svg`;
          } else if (skinType === "Golden") {
            skinFileName = `GF${generation}_Golden.svg`;
          } else {
            // Para otros skins: GF{gen}-{skinType}.svg
            skinFileName = `GF${generation}-${skinType}.svg`;
          }
          
          const adrianGfPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', `GF${generation}`, skinFileName);
          console.log(`[custom-render] Cargando ADRIANGF desde sistema de archivos: ${adrianGfPath}`);
          
          const svgContent = fs.readFileSync(adrianGfPath, 'utf8');
          
          // Intentar obtener del caché SVG→PNG primero
          const cachedPng = getCachedSvgPng(svgContent);
          if (cachedPng) {
            return loadImage(cachedPng);
          }
          
          // Si no está en caché, hacer la conversión
          const resvg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            }
          });
          
          const pngBuffer = resvg.render().asPng();
          
          // Guardar en caché SVG→PNG
          setCachedSvgPng(svgContent, pngBuffer);
          
          return loadImage(pngBuffer);
        } else if (serumName === "GoldenAdrian") {
          console.log(`[custom-render] 🧬 LÓGICA ESPECIAL: Cargando skin GoldenAdrian para GEN${generation}, skin ${skinType}`);
          
          // Para GoldenAdrian, siempre usar el skin Golden independientemente del skinType original
          const skinFileName = `GEN${generation}-Golden.svg`;
          
          const goldenAdrianPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', skinFileName);
          console.log(`[custom-render] Cargando GoldenAdrian desde sistema de archivos: ${goldenAdrianPath}`);
          
          const svgContent = fs.readFileSync(goldenAdrianPath, 'utf8');
          
          // Intentar obtener del caché SVG→PNG primero
          const cachedPng = getCachedSvgPng(svgContent);
          if (cachedPng) {
            return loadImage(cachedPng);
          }
          
          // Si no está en caché, hacer la conversión
          const resvg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            }
          });
          
          const pngBuffer = resvg.render().asPng();
          
          // Guardar en caché SVG→PNG
          setCachedSvgPng(svgContent, pngBuffer);
          
          return loadImage(pngBuffer);
        } else {
          // Lógica original para otros serums
          const serumNameUpper = serumName.toUpperCase();
          const adrianPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `${serumNameUpper}.svg`);
          console.log(`[custom-render] Cargando Adrian desde sistema de archivos: ${adrianPath}`);
          
          const svgContent = fs.readFileSync(adrianPath, 'utf8');
          
          // Intentar obtener del caché SVG→PNG primero
          const cachedPng = getCachedSvgPng(svgContent);
          if (cachedPng) {
            return loadImage(cachedPng);
          }
          
          // Si no está en caché, hacer la conversión
          const resvg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            }
          });
          
          const pngBuffer = resvg.render().asPng();
          
          // Guardar en caché SVG→PNG
          setCachedSvgPng(svgContent, pngBuffer);
          
          return loadImage(pngBuffer);
        }
      } catch (error) {
        console.error(`[custom-render] Error cargando Adrian SVG ${serumName}:`, error.message);
        return null;
      }
    };

    // NUEVA FUNCIÓN: Cargar directamente desde labimages/ usando solo traitId
    const loadTraitFromLabimages = async (traitId) => {
      console.log(`[custom-render] 🎨 CARGANDO TRAIT: Iniciando carga de trait ${traitId}`);
      
      // LÓGICA OGPUNKS: Cargar desde carpeta ogpunks cuando el traitId esté en su rango
      if ((parseInt(traitId) >= 100001 && parseInt(traitId) <= 101003) || (parseInt(traitId) >= 101001 && parseInt(traitId) <= 101003)) {
        console.log(`[custom-render] 🎯 LÓGICA OGPUNKS: Trait ${traitId} detectado como OGPUNK, usando loader OGPUNKS`);
        return await loadOgpunkTrait(traitId);
      }

      // LÓGICA ESPECIAL: Tokens 30000-35000 usan URL externa
      if (isExternalTrait(traitId)) {
        console.log(`[custom-render] 🌐 LÓGICA EXTERNA: Trait ${traitId} detectado en rango externo, usando carga externa`);
        
        // Verificar si el trait está en el mapeo combinado
        if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
          console.log(`[custom-render] 🌐 LÓGICA EXTERNA: Trait ${traitId} confirmado en mapeo combinado como externo`);
          console.log(`[custom-render] 🌐 LÓGICA EXTERNA: Info del trait:`, {
            name: traitsMapping[traitId].name,
            category: traitsMapping[traitId].category,
            external_url: traitsMapping[traitId].external_url
          });
        } else {
          console.warn(`[custom-render] 🌐 LÓGICA EXTERNA: Trait ${traitId} en rango externo pero no encontrado en mapeo combinado`);
        }
        
        return await loadExternalTrait(traitId);
      }
      
      // Verificar si el trait está en el mapeo combinado para debug
      if (traitsMapping[traitId]) {
        console.log(`[custom-render] 🎨 CARGANDO TRAIT: Trait ${traitId} encontrado en mapeo:`, {
          name: traitsMapping[traitId].name,
          category: traitsMapping[traitId].category,
          fileName: traitsMapping[traitId].fileName,
          isExternal: traitsMapping[traitId].isExternal || false,
          isOgpunk: traitsMapping[traitId].isOgpunk || false
        });
      } else {
        console.warn(`[custom-render] 🎨 CARGANDO TRAIT: Trait ${traitId} no encontrado en mapeo combinado`);
      }
      
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
        console.log(`[custom-render] 🎨 CARGANDO TRAIT: Cargando desde labimages: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        const svgContent = Buffer.from(svgBuffer);
        console.log(`[custom-render] 🎨 CARGANDO TRAIT: SVG descargado, tamaño: ${svgBuffer.byteLength} bytes`);
        
        // Intentar obtener del caché SVG→PNG primero
        const cachedPng = getCachedSvgPng(svgContent.toString());
        if (cachedPng) {
          const image = await loadImage(cachedPng);
          console.log(`[custom-render] 🎨 CARGANDO TRAIT: Trait ${traitId} cargado exitosamente desde caché SVG→PNG`);
          return image;
        }
        
        // Si no está en caché, hacer la conversión
        const resvg = new Resvg(svgContent, {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[custom-render] 🎨 CARGANDO TRAIT: PNG generado, tamaño: ${pngBuffer.length} bytes`);
        
        // Guardar en caché SVG→PNG
        setCachedSvgPng(svgContent.toString(), pngBuffer);
        
        const image = await loadImage(pngBuffer);
        console.log(`[custom-render] 🎨 CARGANDO TRAIT: Trait ${traitId} cargado exitosamente desde labimages`);
        return image;
      } catch (error) {
        console.error(`[custom-render] 🎨 CARGANDO TRAIT: Error cargando trait ${traitId} desde labimages:`, error.message);
        return null;
      }
    };

    // NUEVA FUNCIÓN: Cargar trait desde ogpunks para tokens 100001-101003
    const loadOgpunkTrait = async (traitId) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/ogpunks/${traitId}.svg`;
        console.log(`[custom-render] 🎯 LÓGICA OGPUNKS: Cargando trait ${traitId} desde ogpunks: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        console.log(`[custom-render] 🎯 LÓGICA OGPUNKS: SVG descargado desde ogpunks, tamaño: ${svgBuffer.byteLength} bytes`);
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[custom-render] 🎯 LÓGICA OGPUNKS: PNG generado desde ogpunks, tamaño: ${pngBuffer.length} bytes`);
        
        const image = await loadImage(pngBuffer);
        console.log(`[custom-render] 🎯 LÓGICA OGPUNKS: Trait ${traitId} cargado exitosamente desde ogpunks`);
        return image;
      } catch (error) {
        console.error(`[custom-render] 🎯 LÓGICA OGPUNKS: Error cargando trait ${traitId} desde ogpunks:`, error.message);
        console.error(`[custom-render] 🎯 LÓGICA OGPUNKS: Stack trace:`, error.stack);
        return null;
      }
    };

    // Determinar la imagen base según generación y skin
    const gen = generation.toString();
    let baseImagePath;

    // Mapear skin para determinar la imagen a mostrar
    let skinType;
    
    console.log('[custom-render] Analizando skin:', {
      skinId,
      skinName,
      generacion: gen
    });
    
    if (skinName === "Zero" || skinId === "0" || skinId === "1") {
      skinType = "Medium";
      console.log('[custom-render] Skin Zero detectado, usando Medium');
    } else if (skinId === "2" || skinName === "Dark") {
      skinType = "Dark";
    } else if (skinId === "3" || skinName === "Alien") {
      skinType = "Alien";
    } else {
      skinType = skinName || "Medium";
    }

    // Construir path del Adrian base
    baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
    console.log('[custom-render] Path de imagen base:', baseImagePath);

    // Verificar si hay un trait de skin excepcional
    let skinTraitPath = null;
    if (finalTraits['SKIN']) {
      skinTraitPath = getSkinTraitPath(finalTraits['SKIN'], gen);
      if (skinTraitPath) {
        console.log(`[custom-render] Detectado trait de skin excepcional: ${skinTraitPath}`);
      }
    }

    // LÓGICA ESPECIAL: Detectar serum aplicado y cambiar skin base
    let appliedSerum = null; // Solo para serums exitosos
    let serumSuccess = false;
    let hasSerumHistory = false;
    let serumFailed = false;
    let failedSerumType = null; // Nueva variable para el tipo de serum que falló
    let hasAdrianGFSerum = false;
    let serumHistory = null;
    try {
      console.log('[custom-render] Verificando si hay serum aplicado...');
      serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        hasSerumHistory = true;
        const lastSerum = serumHistory[serumHistory.length - 1];
        serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        console.log(`[custom-render] Historial de serum encontrado:`, {
          success: serumSuccess,
          mutation: serumMutation,
          hasBeenModified: hasBeenModified
        });
        
        // Verificar si hay un AdrianGF previo en el historial
        for (const serum of serumHistory) {
          if (serum[1] === true && serum[3] === "AdrianGF") {
            hasAdrianGFSerum = true;
            console.log(`[custom-render] AdrianGF previo detectado en historial`);
            break;
          }
        }
        
        // LÓGICA CORREGIDA según el contrato SerumModule (consistente con metadata):
        // - Serum exitoso: success = true Y mutation tiene valor
        // - Serum fallido: success = false (independientemente del valor de mutation)
        if (serumSuccess) {
          // Serum exitoso
          if (serumMutation) {
            appliedSerum = serumMutation;
            console.log(`[custom-render] Serum exitoso detectado: ${appliedSerum}`);
          } else {
            console.warn(`[custom-render] Serum marcado como exitoso pero sin mutación, esto no debería pasar`);
          }
        } else {
          // Serum fallido (consistente con metadata: "FAILED")
          serumFailed = true;
          if (serumMutation) {
            failedSerumType = serumMutation;
          } else {
            // Si no hay mutation, buscar en el historial completo
            for (let i = serumHistory.length - 1; i >= 0; i--) {
              const serum = serumHistory[i];
              if (serum[3] && (serum[3] === "AdrianGF" || serum[3] === "GoldenAdrian")) {
                failedSerumType = serum[3];
                break;
              }
            }
          }
          console.log(`[custom-render] Serum fallido detectado: ${failedSerumType || 'desconocido'} (será "FAILED" en metadata)`);
        }
      }
    } catch (error) {
      console.log('[custom-render] Error verificando serum aplicado:', error.message);
    }

    // 1. PRIMERO: Renderizar BACKGROUND si existe
    if (finalTraits['BACKGROUND']) {
      const bgPath = `BACKGROUND/${finalTraits['BACKGROUND']}.svg`;
      console.log(`[custom-render] PASO 1 - Cargando background: ${bgPath}`);
      
      // Intentar obtener del caché de componentes primero
      const cachedBackground = getCachedComponent('background', finalTraits['BACKGROUND']);
      if (cachedBackground) {
        const bgImage = await loadImage(cachedBackground);
        ctx.drawImage(bgImage, 0, 0, 1000, 1000);
        console.log('[custom-render] PASO 1 - Background renderizado correctamente desde caché de componentes');
      } else {
        // Si no está en caché, cargar normalmente
        const bgImage = await loadAndRenderSvg(bgPath);
        if (bgImage) {
          // Convertir la imagen a buffer para guardar en caché
          const canvas = createCanvas(1000, 1000);
          const bgCtx = canvas.getContext('2d');
          bgCtx.drawImage(bgImage, 0, 0, 1000, 1000);
          const bgBuffer = canvas.toBuffer('image/png');
          
          // Guardar en caché de componentes
          setCachedComponent('background', finalTraits['BACKGROUND'], bgBuffer);
          
          ctx.drawImage(bgImage, 0, 0, 1000, 1000);
          console.log('[custom-render] PASO 1 - Background renderizado correctamente');
        }
      }
    }

    // 2. SEGUNDO: Renderizar el SKIN (Adrian base, excepción o serum)
    console.log('[custom-render] PASO 2 - Iniciando carga del skin');
    
    // LÓGICA ESPECIAL: Si hay serum aplicado, usar el skin del serum
    if (appliedSerum) {
      console.log(`[custom-render] PASO 2 - 🧬 LÓGICA ESPECIAL: Usando skin de serum aplicado: ${appliedSerum}, éxito: ${serumSuccess}`);
      
      // LÓGICA ESPECIAL: GoldenAdrian prevalece sobre AdrianGF
      if (appliedSerum === "GoldenAdrian") {
        if (serumSuccess) {
          // GoldenAdrian exitoso: usar skin Golden específico
          const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
          if (serumSkinImage) {
            ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
            console.log(`[custom-render] PASO 2 - 🧬 Skin GoldenAdrian exitoso (GEN${gen}, Golden) renderizado correctamente`);
          } else {
            console.error(`[custom-render] PASO 2 - Error al cargar skin GoldenAdrian exitoso, usando skin base normal`);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              ctx.drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[custom-render] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        } else {
          // GoldenAdrian fallido: determinar qué archivo de fallo usar
          let failPath;
          if (hasAdrianGFSerum) {
            // Si hay un AdrianGF previo, usar GF-Goldfail.svg
            failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Goldfail.svg');
            console.log(`[custom-render] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum GoldenAdrian fallido en AdrianGF, usando GF-Goldfail`);
          } else {
            // Si no hay AdrianGF previo, usar GEN{gen}-Goldenfail.svg
            failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `GEN${gen}-Goldenfail.svg`);
            console.log(`[custom-render] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum GoldenAdrian fallido, usando GEN${gen}-Goldenfail`);
          }
          
          try {
            const svgContent = fs.readFileSync(failPath, 'utf8');
            const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1000 } });
            const pngBuffer = resvg.render().asPng();
            const failImage = await loadImage(pngBuffer);
            ctx.drawImage(failImage, 0, 0, 1000, 1000);
            console.log(`[custom-render] PASO 2 - 🧬 Skin GoldenAdrian fallido renderizado correctamente`);
          } catch (error) {
            console.error(`[custom-render] PASO 2 - Error al cargar skin de fallo GoldenAdrian, usando skin base normal:`, error.message);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              ctx.drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[custom-render] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        }
      } else if (appliedSerum === "AdrianGF") {
        if (serumSuccess) {
          // AdrianGF exitoso: CONVERSIÓN sobre estado previo (Golden / Goldenfail)
          let convertedHandled = false;
          if (hasSerumHistory) {
            // Buscar el último evento GoldenAdrian antes del éxito de AdrianGF
            for (let i = serumHistory.length - 2; i >= 0; i--) {
              const ev = serumHistory[i];
              const evSuccess = ev[1];
              const evMutation = ev[3];
              if (evMutation === 'GoldenAdrian') {
                if (evSuccess === false) {
                  // GoldenAdrian fallido previo + AdrianGF exitoso → GF-Goldfail
                  try {
                    const failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Goldfail.svg');
                    const svgContent = fs.readFileSync(failPath, 'utf8');
                    const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1000 } });
                    const pngBuffer = resvg.render().asPng();
                    const failImage = await loadImage(pngBuffer);
                    ctx.drawImage(failImage, 0, 0, 1000, 1000);
                    console.log('[custom-render] PASO 2 - 🧬 Conversión GF sobre Goldenfail: usando GF-Goldfail');
                    convertedHandled = true;
                  } catch (error) {
                    console.error('[custom-render] Error cargando GF-Goldfail, fallback a GF estándar:', error.message);
                  }
                } else if (evSuccess === true) {
                  // GoldenAdrian exitoso previo + AdrianGF exitoso → GF{gen}-Golden
                  const serumSkinImage = await loadAdrianSvg('AdrianGF', gen, 'Golden');
                  if (serumSkinImage) {
                    ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
                    console.log(`[custom-render] PASO 2 - 🧬 Conversión GF sobre Golden: usando GF${gen}_Golden`);
                    convertedHandled = true;
                  }
                }
                break; // Considerar solo el último GoldenAdrian previo
              }
            }
          }

          if (!convertedHandled) {
            // Render GF normal según skinType (Alien, Albino, Medium, etc.)
            const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
            if (serumSkinImage) {
              ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
              console.log(`[custom-render] PASO 2 - 🧬 Skin ADRIANGF exitoso (GEN${gen}, ${skinType}) renderizado correctamente`);
            } else {
              console.error(`[custom-render] PASO 2 - Error al cargar skin ADRIANGF exitoso, usando skin base normal`);
              const baseImage = await loadAndRenderSvg(baseImagePath);
              if (baseImage) {
                ctx.drawImage(baseImage, 0, 0, 1000, 1000);
                console.log('[custom-render] PASO 2 - Skin base renderizado correctamente (fallback)');
              }
            }
          }
        } else {
          // AdrianGF fallido: usar GF-Fail.svg
          console.log(`[custom-render] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum ADRIANGF fallido, usando GF-Fail`);
          const failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
          try {
            const svgContent = fs.readFileSync(failPath, 'utf8');
            const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1000 } });
            const pngBuffer = resvg.render().asPng();
            const failImage = await loadImage(pngBuffer);
            ctx.drawImage(failImage, 0, 0, 1000, 1000);
            console.log('[custom-render] PASO 2 - 🧬 Skin ADRIANGF fallido (GF-Fail) renderizado correctamente');
          } catch (error) {
            console.error(`[custom-render] PASO 2 - Error al cargar GF-Fail, usando skin base normal:`, error.message);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              ctx.drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[custom-render] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        }
      } else {
        // Otros serums: lógica original
        const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
        if (serumSkinImage) {
          ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
          console.log(`[custom-render] PASO 2 - 🧬 Skin de serum ${appliedSerum} renderizado correctamente`);
        } else {
          console.error(`[custom-render] PASO 2 - Error al cargar skin de serum, usando skin base normal`);
          const baseImage = await loadAndRenderSvg(baseImagePath);
          if (baseImage) {
            ctx.drawImage(baseImage, 0, 0, 1000, 1000);
            console.log('[custom-render] PASO 2 - Skin base renderizado correctamente (fallback)');
          }
        }
      }
    }
    // LÓGICA ESPECIAL: Si hay historial de serum pero no hay mutación (serum fallido)
    else if (serumFailed) {
      console.log(`[custom-render] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum fallido detectado, usando archivo de fallo`);
      
      // Determinar qué archivo de fallo usar según el serum
      let failPath;
      if (failedSerumType === "AdrianGF") {
        failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
      } else if (failedSerumType === "GoldenAdrian") {
        // Verificar si es un AdrianGF con GoldenAdrian fallido
        if (hasAdrianGFSerum) {
          failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Goldfail.svg');
        } else {
          failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `GEN${gen}-Goldenfail.svg`);
        }
      } else {
        // Fallback para otros serums
        failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
      }
      
      try {
        const svgContent = fs.readFileSync(failPath, 'utf8');
        const resvg = new Resvg(svgContent, {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        const pngBuffer = resvg.render().asPng();
        const failImage = await loadImage(pngBuffer);
        ctx.drawImage(failImage, 0, 0, 1000, 1000);
        console.log(`[custom-render] PASO 2 - 🧬 Skin ${failedSerumType || 'serum'} fallido renderizado correctamente`);
      } catch (error) {
        console.error(`[custom-render] PASO 2 - Error al cargar skin de fallo, usando skin base normal:`, error.message);
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[custom-render] PASO 2 - Skin base renderizado correctamente (fallback)');
        }
      }
    }
    // Si hay un trait de skin excepcional, usarlo en lugar del skin base
    else if (skinTraitPath) {
      console.log(`[custom-render] PASO 2 - Usando skin excepcional: ${skinTraitPath}`);
      const skinImage = await loadAndRenderSvg(skinTraitPath);
      if (skinImage) {
        ctx.drawImage(skinImage, 0, 0, 1000, 1000);
        console.log('[custom-render] PASO 2 - Skin excepcional renderizado correctamente');
      }
    } else {
      // Usar skin base normal
      console.log('[custom-render] PASO 2 - Usando skin base normal');
      const baseImage = await loadAndRenderSvg(baseImagePath);
      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, 1000, 1000);
        console.log('[custom-render] PASO 2 - Skin base renderizado correctamente');
      } else {
        console.error('[custom-render] PASO 2 - Error al cargar el skin, intentando fallback');
        const fallbackPath = `ADRIAN/GEN${gen}-Medium.svg`;
        const fallbackImage = await loadAndRenderSvg(fallbackPath);
        if (fallbackImage) {
          ctx.drawImage(fallbackImage, 0, 0, 1000, 1000);
          console.log('[custom-render] PASO 2 - Skin fallback renderizado correctamente');
        }
      }
    }

    // 2.5. RENDERIZAR SKIN TRAITS ESPECIALES (tokens 37, 38) encima del skin base
    console.log('[custom-render] PASO 2.5 - Renderizando skin traits especiales');
    if (finalTraits['SWAG'] === '37' || finalTraits['SWAG'] === '38') {
      const skinTraitId = finalTraits['SWAG'];
      const skinTraitPath = `SKIN/${skinTraitId}.svg`;
      console.log(`[custom-render] PASO 2.5 - Renderizando skin trait especial: ${skinTraitPath}`);
      
      const skinTraitImage = await loadAndRenderSvg(skinTraitPath);
      if (skinTraitImage) {
        ctx.drawImage(skinTraitImage, 0, 0, 1000, 1000);
        console.log(`[custom-render] PASO 2.5 - Skin trait especial ${skinTraitId} renderizado correctamente`);
      }
    }

    // NOTA: Los traits externos de SWAG (30000+) se renderizan en el PASO 3 con el orden normal de capas
    // No necesitan lógica especial aquí porque siguen la misma jerarquía que los traits SWAG normales

    // 3. TERCERO: Renderizar resto de traits
    console.log('[custom-render] PASO 3 - Iniciando renderizado de traits adicionales');
    // Ajuste: HEAD por encima de HAIR
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'RANDOMSHIT', 'SWAG', 'HAIR', 'HEAD', 'HAT', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];

    for (const category of traitOrder) {
      if (finalTraits[category]) {
        // LÓGICA ESPECIAL: No renderizar HAIR 21 si HEAD 209 está activo
        if (category === 'HAIR' && finalTraits['HAIR'] === '21' && finalTraits['HEAD'] === '209') {
          console.log('[custom-render] LÓGICA ESPECIAL: No renderizar HAIR 21 porque HEAD 209 está activo');
          continue;
        }
        // Solo para traits visuales normales (no ADRIAN ni ADRIANGF)
        if (category !== 'ADRIAN' && category !== 'ADRIANGF') {
          // LÓGICA DE EXCLUSIVIDAD: SERUMS solo si NO hay EYES
          if (category === 'SERUMS') {
            const eyesTrait = finalTraits['EYES'];
            if (eyesTrait && eyesTrait !== 'None' && eyesTrait !== '') {
              console.log(`[custom-render] PASO 3 - 🚫 LÓGICA DE EXCLUSIVIDAD: Saltando SERUMS (${finalTraits[category]}) porque hay EYES (${eyesTrait}) activado`);
              continue; // Saltar SERUMS si hay EYES activados
            }
          }
          const traitId = finalTraits[category];
          
          // Debug mejorado para traits externos
          if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
            console.log(`[custom-render] 🌐 PASO 3 - Renderizando trait externo: ${category} (${traitId}) - ${traitsMapping[traitId].name}`);
          }
          
          // Intentar obtener del caché de componentes primero
          const cachedTrait = getCachedComponent('trait', traitId);
          if (cachedTrait) {
            const traitImage = await loadImage(cachedTrait);
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            
            // Debug mejorado para traits externos
            if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
              console.log(`[custom-render] 🌐 PASO 3 - Trait externo ${category} (${traitId}) renderizado correctamente desde caché de componentes`);
            } else {
              console.log(`[custom-render] PASO 3 - Trait ${category} (${traitId}) renderizado desde caché de componentes correctamente`);
            }
          } else {
            // Si no está en caché, cargar normalmente
            const traitImage = await loadTraitFromLabimages(traitId);
            if (traitImage) {
              // Convertir la imagen a buffer para guardar en caché
              const canvas = createCanvas(1000, 1000);
              const traitCtx = canvas.getContext('2d');
              traitCtx.drawImage(traitImage, 0, 0, 1000, 1000);
              const traitBuffer = canvas.toBuffer('image/png');
              
              // Guardar en caché de componentes
              setCachedComponent('trait', traitId, traitBuffer);
              
              ctx.drawImage(traitImage, 0, 0, 1000, 1000);
              
              // Debug mejorado para traits externos
              if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
                console.log(`[custom-render] 🌐 PASO 3 - Trait externo ${category} (${traitId}) renderizado correctamente desde URL externa`);
              } else {
                console.log(`[custom-render] PASO 3 - Trait ${category} (${traitId}) renderizado desde labimages correctamente`);
              }
            } else {
              console.error(`[custom-render] PASO 3 - Error al cargar trait ${category} (${traitId}) desde labimages`);
            }
          }
        }
      }
    }

    // 4. CUARTO: Renderizar TOP layers (van encima de todas las demás)
    console.log('[custom-render] PASO 4 - Iniciando renderizado de TOP layers');
    const topOrder = ['TOP'];

    for (const category of topOrder) {
      if (finalTraits[category]) {
        const traitId = finalTraits[category];
        
        // Intentar obtener del caché de componentes primero
        const cachedTopTrait = getCachedComponent('trait', traitId);
        if (cachedTopTrait) {
          const traitImage = await loadImage(cachedTopTrait);
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
          if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
            console.log(`[custom-render] 🌐 PASO 4 - TOP trait externo ${category} (${traitId}) renderizado correctamente desde caché de componentes`);
          } else {
            console.log(`[custom-render] PASO 4 - TOP trait ${category} (${traitId}) renderizado desde caché de componentes correctamente`);

        // LÓGICA ESPECIAL: Si el TOP trait es 101003 CAESAR → responder con GIF
        if (category === 'TOP' && traitId === 101003) {
          try {
            const gifResponse = await fetch('https://adrianlab.vercel.app/labimages/ogpunks/101003.gif');
            if (gifResponse.ok) {
              const gifBuffer = await gifResponse.arrayBuffer();
              res.setHeader('Content-Type', 'image/gif');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.send(Buffer.from(gifBuffer));
              return;
            }
          } catch (e) {
            console.log(`[render] Fallback a SVG para CAESAR:`, e.message);
          }
        }          }
        } else {
          let traitImage;
          if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
            traitImage = await loadExternalTrait(traitId);
          } else if (traitId >= 100001 && traitId <= 101003) {
            traitImage = await loadOgpunkTrait(traitId);
          } else {
            traitImage = await loadTraitFromLabimages(traitId);
          }

          if (traitImage) {
            // Cache de componentes
            const cacheCanvas = createCanvas(1000, 1000);
            const cacheCtx = cacheCanvas.getContext('2d');
            cacheCtx.drawImage(traitImage, 0, 0, 1000, 1000);
            const traitBuffer = cacheCanvas.toBuffer('image/png');
            setCachedComponent('trait', traitId, traitBuffer);

            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            if (traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
              console.log(`[custom-render] 🌐 PASO 4 - TOP trait externo ${category} (${traitId}) renderizado correctamente desde URL externa`);
            } else if (traitId >= 100001 && traitId <= 101003) {
              console.log(`[custom-render] 🎯 LÓGICA OGPUNKS: TOP trait ${category} (${traitId}) renderizado desde ogpunks correctamente`);
            } else {
              console.log(`[custom-render] PASO 4 - TOP trait ${category} (${traitId}) renderizado desde labimages correctamente`);
            }
          } else {
            console.error(`[custom-render] PASO 4 - Error al cargar TOP trait ${category} (${traitId})`);
          }
        }
      }
    }

    // LÓGICA ESPECIAL: Renderizar token 48 (S.W.A.T-Shild) en TOP
    if (finalTraits['GEAR'] === '48') {
      const specialTraitPath = `GEAR/48.svg`;
      console.log(`[custom-render] PASO 4 - 🎯 LÓGICA ESPECIAL: Renderizando token 48 en TOP: ${specialTraitPath}`);

      const specialTraitImage = await loadAndRenderSvg(specialTraitPath);
      if (specialTraitImage) {
        ctx.drawImage(specialTraitImage, 0, 0, 1000, 1000);
        console.log(`[custom-render] PASO 4 - 🎯 Token 48 renderizado correctamente en TOP`);
      }
    }

    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Enviar imagen
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    console.log('[custom-render] Renderizado personalizado completado exitosamente');

  } catch (error) {
    console.error('[custom-render] Error general:', error);
    console.error('[custom-render] Stack trace:', error.stack);
    
    // En caso de error, devolver una imagen de error
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Fondo gris
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Texto de error
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error Custom Render', 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText(`Token #${req.query.tokenId?.replace('.png', '') || 'Unknown'}`, 500, 500);
    ctx.font = '18px Arial';
    ctx.fillText(error.message.substring(0, 50), 500, 550);
    
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
} 
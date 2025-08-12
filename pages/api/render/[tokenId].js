// API endpoint for rendering tokens by tokenId
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../lib/contracts.js';
import { 
  getCachedAdrianZeroRender, 
  setCachedAdrianZeroRender, 
  getAdrianZeroRenderTTL 
} from '../../../lib/cache.js';
import { getCachedSvgPng, setCachedSvgPng } from '../../../lib/svg-png-cache.js';
import { getCachedComponent, setCachedComponent } from '../../../lib/component-cache.js';

// Función para normalizar categorías a mayúsculas
const normalizeCategory = (category) => {
  // Todas las categorías ya están en mayúsculas en traits.json
  // Solo mantener el mapeo PACKS->SWAG para compatibilidad con el contrato
  const categoryMap = {
    'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
  };
  
  return categoryMap[category] || category;
};

// LÓGICA ESPECIAL: Mapear ciertos tokens de HEAD a HAIR (solo peinados reales, no accesorios)
const HEAD_TO_HAIR_TOKENS = [
  14, 17, 18, 19, 21, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 188, 190, 198, 199, 203, 204, 207, 218, 219, 226, 236
];

// Función para verificar si un token debe renderizarse como HAIR
const shouldRenderAsHair = (traitId) => {
  return HEAD_TO_HAIR_TOKENS.includes(parseInt(traitId));
};

// LÓGICA ESPECIAL: Mapear tokens mal categorizados en el contrato
const CATEGORY_CORRECTIONS = {
  // Token 8 (3D Laser Eyes) y Token 7 (3D Glasses) están en SERUMS pero son EYES
  7: 'EYES',
  8: 'EYES',
  9: 'EYES'  // Token 9 también está mal categorizado
};

// Función para corregir categoría según el token ID
const correctCategory = (category, traitId) => {
  const correctedCategory = CATEGORY_CORRECTIONS[parseInt(traitId)];
  if (correctedCategory) {
    console.log(`[render] LÓGICA ESPECIAL: Token ${traitId} corregido de ${category} a ${correctedCategory}`);
    return correctedCategory;
  }
  return category;
};

// =============================================
// FUNCIÓN PARA CARGAR METADATA SEGÚN TOKEN ID
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
  } else if (numTokenId >= 100001 && numTokenId <= 101000) {
    return 'ogpunks.json';
  } else {
    return 'traits.json';
  }
};

// Función para cargar metadata del archivo correcto
const loadMetadataForToken = (tokenId) => {
  try {
    const metadataFile = getMetadataFileForToken(tokenId);
    const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', metadataFile);
    
    console.log(`[render] Cargando metadata desde: ${metadataFile} para token ${tokenId}`);
    
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
    
    return traitsArray;
  } catch (error) {
    console.error(`[render] Error cargando metadata para token ${tokenId}:`, error.message);
    return [];
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
    console.log(`[render] Iniciando renderizado para token ${cleanTokenId}`);

    // Verify that tokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[render] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // ===== SISTEMA DE CACHÉ PARA ADRIANZERO RENDER =====
    const cachedImage = getCachedAdrianZeroRender(cleanTokenId);
    
    if (cachedImage) {
      console.log(`[render] 🎯 CACHE HIT para token ${cleanTokenId}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Version', 'ADRIANZERO-CACHED');
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[render] 💾 CACHE MISS para token ${cleanTokenId} - Generando imagen...`);

    // Conectar con los contratos
    console.log('[render] Conectando con los contratos...');
    const { core, traitsExtension, patientZero, serumModule } = await getContracts();

    // Obtener datos del token
    console.log('[render] Obteniendo datos del token...');
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    
    console.log('[render] TokenData:', {
      generation: generation.toString(),
      mutationLevel: mutationLevel.toString(),
      canReplicate,
      hasBeenModified
    });

    // Obtener skin del token
    console.log('[render] Obteniendo skin del token...');
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log('[render] Skin info:', {
      skinId,
      skinName
    });

    // Obtener traits equipados
    console.log('[render] Obteniendo traits equipados...');
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    console.log('[render] Traits equipados (anidado):', {
      categories,
      traitIds: traitIds.map(id => id.toString())
    });

    // Crear canvas con fondo blanco
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    console.log('[render] Canvas creado con fondo blanco');

    // Función para cargar y renderizar SVG con caché
    const loadAndRenderSvg = async (path) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/traits/${path}`;
        console.log(`[render] Cargando imagen: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
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
        console.error(`[render] Error cargando SVG ${path}:`, error.message);
        return null;
      }
    };

    // Función específica para cargar archivos ADRIAN desde sistema de archivos
    const loadAdrianSvg = async (serumName, generation, skinType) => {
      try {
        // LÓGICA ESPECIAL PARA ADRIANGF: Usar estructura de carpetas específica
        if (serumName === "AdrianGF") {
          console.log(`[render] 🧬 LÓGICA ESPECIAL: Cargando skin ADRIANGF para GEN${generation}, skin ${skinType}`);
          
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
          console.log(`[render] Cargando ADRIANGF desde sistema de archivos: ${adrianGfPath}`);
          
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
          console.log(`[render] 🧬 LÓGICA ESPECIAL: Cargando skin GoldenAdrian para GEN${generation}, skin ${skinType}`);
          
          // Para GoldenAdrian, siempre usar el skin Golden independientemente del skinType original
          const skinFileName = `GEN${generation}-Golden.svg`;
          
          const goldenAdrianPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', skinFileName);
          console.log(`[render] Cargando GoldenAdrian desde sistema de archivos: ${goldenAdrianPath}`);
          
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
          console.log(`[render] Cargando Adrian desde sistema de archivos: ${adrianPath}`);
          
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
        console.error(`[render] Error cargando Adrian SVG ${serumName}:`, error.message);
        return null;
      }
    };

    // NUEVA FUNCIÓN: Cargar directamente desde labimages/ usando solo traitId
    const loadTraitFromLabimages = async (traitId) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
        console.log(`[render] Cargando trait desde labimages: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
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
        console.error(`[render] Error cargando trait ${traitId} desde labimages:`, error.message);
        return null;
      }
    };

    // NUEVA FUNCIÓN: Cargar trait desde URL externa para tokens 30000-35000
    const loadExternalTrait = async (traitId) => {
      try {
        const baseUrl = 'https://adrianzero.com/designs';
        const imageUrl = `${baseUrl}/${traitId}.svg`;
        console.log(`[render] 🌐 Cargando trait ${traitId} desde URL externa: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        console.log(`[render] 🌐 SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[render] 🌐 Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        const image = await loadImage(pngBuffer);
        console.log(`[render] 🌐 LÓGICA EXTERNA: Trait ${traitId} cargado exitosamente desde URL externa`);
        return image;
      } catch (error) {
        console.error(`[render] 🌐 LÓGICA EXTERNA: Error cargando trait ${traitId} desde URL externa:`, error.message);
        console.error(`[render] 🌐 LÓGICA EXTERNA: Stack trace:`, error.stack);
        return null;
      }
    };

    // NUEVA FUNCIÓN: Cargar trait desde ogpunks para tokens 100001-101000
    const loadOgpunkTrait = async (traitId) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/ogpunks/${traitId}.svg`;
        console.log(`[render] 🎯 LÓGICA OGPUNKS: Cargando trait ${traitId} desde ogpunks: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
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
        console.error(`[render] 🎯 LÓGICA OGPUNKS: Error cargando trait ${traitId} desde ogpunks:`, error.message);
        return null;
      }
    };

    // Determinar la imagen base según generación y skin
    const gen = generation.toString();
    let baseImagePath;

    // Mapear skin para determinar la imagen a mostrar
    let skinType;
    let useMannequin = false;
    
    console.log('[render] Analizando skin:', {
      skinId,
      skinName,
      generacion: gen
    });
    
    // Lógica del skin basada en el contrato:
    // - skinId = 0: No hay skin asignado (usar mannequin.svg)
    // - skinId = 1: Skin "Zero" (usar Medium)
    // - skinId = 2: Skin "Dark" (usar Dark)
    // - skinId = 3: Skin "Alien" (usar Alien)
    // - skinId = 4: Skin "Albino" (usar Albino)
    if (skinId.toString() === "0") {
      useMannequin = true;
      console.log('[render] Skin no asignado detectado (skinId = 0), usando mannequin.svg');
    } else if (skinId.toString() === "1" || skinName === "Zero") {
      skinType = "Medium";
      console.log('[render] Skin Zero detectado (skinId = 1), usando Medium');
    } else if (skinId.toString() === "2" || skinName === "Dark") {
      skinType = "Dark";
      console.log('[render] Skin Dark detectado (skinId = 2), usando Dark');
    } else if (skinId.toString() === "3" || skinName === "Alien") {
      skinType = "Alien";
      console.log('[render] Skin Alien detectado (skinId = 3), usando Alien');
    } else if (skinId.toString() === "4" || skinName === "Albino") {
      skinType = "Albino";
      console.log('[render] Skin Albino detectado (skinId = 4), usando Albino');
    } else {
      skinType = skinName || "Medium";
      console.log(`[render] Skin personalizado detectado: ${skinName} (skinId = ${skinId})`);
    }

    // Construir path del Adrian base (solo si no usamos mannequin)
    if (!useMannequin) {
      baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
    }
    console.log('[render] Path de imagen base:', baseImagePath);
    console.log('[render] Mapeo aplicado:', {
      skinId,
      skinName,
      skinTypeSeleccionado: skinType
    });

    // Crear mapa de traits equipados
    const equippedTraits = {};
    categories.forEach((category, index) => {
      const normalizedCategory = normalizeCategory(category);
      const traitId = traitIds[index].toString();
      
      // LÓGICA ESPECIAL: Si es HEAD y está en la lista de tokens que deben ser HAIR
      if (normalizedCategory === 'HEAD' && shouldRenderAsHair(traitId)) {
        console.log(`[render] LÓGICA ESPECIAL: Token ${traitId} (${normalizedCategory}) será renderizado como HAIR`);
        equippedTraits['HAIR'] = traitId;
      } else {
        equippedTraits[normalizedCategory] = traitId;
      }
    });

    // Verificar si hay un trait de skin excepcional
    let skinTraitPath = null;
    if (equippedTraits['SKIN']) {
      skinTraitPath = getSkinTraitPath(equippedTraits['SKIN'], gen);
      if (skinTraitPath) {
        console.log(`[render] Detectado trait de skin excepcional: ${skinTraitPath}`);
      }
    }

    // LÓGICA ESPECIAL: Detectar serum aplicado y cambiar skin base
    let appliedSerum = null; // Solo para serums exitosos
    let serumFailed = false;
    let failedSerumType = null; // Nueva variable para el tipo de serum que falló
    let hasAdrianGFSerum = false; // Flag para verificar si el serum es AdrianGF
    let serumHistory = null; // Historial completo para conversiones posteriores
    try {
      console.log('[render] Verificando si hay serum aplicado...');
      serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        const lastSerum = serumHistory[serumHistory.length - 1];
        const serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        console.log(`[render] Historial de serum encontrado:`, {
          success: serumSuccess,
          mutation: serumMutation,
          hasBeenModified: hasBeenModified
        });
        
        // Verificar si hay un AdrianGF previo en el historial
        for (const serum of serumHistory) {
          if (serum[1] === true && serum[3] === "AdrianGF") {
            hasAdrianGFSerum = true;
            console.log(`[render] AdrianGF previo detectado en historial`);
            break;
          }
        }
        
        // LÓGICA CORREGIDA: GoldenAdrian prevalece sobre AdrianGF
        // - Serum exitoso: success = true Y mutation tiene valor
        // - Serum fallido: success = false (independientemente del valor de mutation)
        if (serumSuccess) {
          // Serum exitoso
          if (serumMutation) {
            appliedSerum = serumMutation;
            console.log(`[render] Serum exitoso detectado: ${appliedSerum}`);
          } else {
            console.warn(`[render] Serum marcado como exitoso pero sin mutación, esto no debería pasar`);
          }
        } else {
          // Serum fallido (consistente con metadata: "FAILED")
          serumFailed = true;
          // Determinar qué serum falló basándose en el historial completo
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
          console.log(`[render] Serum fallido detectado: ${failedSerumType || 'desconocido'} (será "FAILED" en metadata)`);
        }
      }
    } catch (error) {
      console.log('[render] Error verificando serum aplicado:', error.message);
    }

    // Generar PNG estático (eliminada lógica de animaciones)
    console.log('[render] Generando PNG estático...');

    // 1. PRIMERO: Renderizar BACKGROUND si existe
    if (equippedTraits['BACKGROUND']) {
      const bgPath = `BACKGROUND/${equippedTraits['BACKGROUND']}.svg`;
      console.log(`[render] PASO 1 - Cargando background: ${bgPath}`);
      
      const bgImage = await loadAndRenderSvg(bgPath);
      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, 1000, 1000);
        console.log('[render] PASO 1 - Background renderizado correctamente');
      }
    }

    // 2. SEGUNDO: Renderizar el SKIN (Adrian base, excepción o serum)
    console.log('[render] PASO 2 - Iniciando carga del skin');
    
    // LÓGICA ESPECIAL: Si hay serum aplicado, usar el skin del serum
    if (appliedSerum) {
      console.log(`[render] PASO 2 - 🧬 LÓGICA ESPECIAL: Usando skin de serum aplicado: ${appliedSerum}`);
      
      // LÓGICA ESPECIAL: GoldenAdrian prevalece sobre AdrianGF
      if (appliedSerum === "GoldenAdrian") {
        // GoldenAdrian exitoso: usar skin Golden específico
        const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
        if (serumSkinImage) {
          ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
          console.log(`[render] PASO 2 - 🧬 Skin GoldenAdrian exitoso (GEN${gen}, Golden) renderizado correctamente`);
        } else {
          console.error(`[render] PASO 2 - Error al cargar skin GoldenAdrian exitoso, usando skin base normal`);
          const baseImage = await loadAndRenderSvg(baseImagePath);
          if (baseImage) {
            ctx.drawImage(baseImage, 0, 0, 1000, 1000);
            console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
          }
        }
      } else if (appliedSerum === "AdrianGF") {
        // AdrianGF exitoso: CONVERSIÓN sobre estado previo (Golden / Goldenfail)
        let convertedHandled = false;
        if (serumHistory && serumHistory.length > 1) {
          // Buscar el último evento GoldenAdrian antes del éxito de AdrianGF
          for (let i = serumHistory.length - 2; i >= 0; i--) {
            const ev = serumHistory[i];
            const evSuccess = ev[1];
            const evMutation = ev[3];
            if (evMutation === "GoldenAdrian") {
              if (evSuccess === false) {
                // Caso solicitado: GoldenAdrian fallido + luego AdrianGF exitoso → GF-Goldfail
                try {
                  const failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Goldfail.svg');
                  const svgContent = fs.readFileSync(failPath, 'utf8');
                  const resvg = new Resvg(svgContent, {
                    fitTo: { mode: 'width', value: 1000 }
                  });
                  const pngBuffer = resvg.render().asPng();
                  const failImage = await loadImage(pngBuffer);
                  ctx.drawImage(failImage, 0, 0, 1000, 1000);
                  console.log('[render] PASO 2 - 🧬 Conversión GF sobre Goldenfail: usando GF-Goldfail');
                  convertedHandled = true;
                } catch (error) {
                  console.error('[render] Error cargando GF-Goldfail, fallback a GF estándar:', error.message);
                }
              } else if (evSuccess === true) {
                // GoldenAdrian exitoso previo + AdrianGF exitoso → GF{gen}-Golden
                const overrideSkinType = 'Golden';
                const serumSkinImage = await loadAdrianSvg('AdrianGF', gen, overrideSkinType);
                if (serumSkinImage) {
                  ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
                  console.log(`[render] PASO 2 - 🧬 Conversión GF sobre Golden: usando GF${gen}_Golden`);
                  convertedHandled = true;
                }
              }
              break; // Solo considerar el último GoldenAdrian previo
            }
          }
        }

        if (!convertedHandled) {
          // Render GF normal según skinType (Alien, Albino, Medium, etc.)
          const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
          if (serumSkinImage) {
            ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 2 - 🧬 Skin ADRIANGF exitoso (GEN${gen}, ${skinType}) renderizado correctamente`);
          } else {
            console.error(`[render] PASO 2 - Error al cargar skin ADRIANGF exitoso, usando skin base normal`);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              ctx.drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        }
      } else {
        // Otros serums: lógica original
        const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
        if (serumSkinImage) {
          ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
          console.log(`[render] PASO 2 - 🧬 Skin de serum ${appliedSerum} renderizado correctamente`);
        } else {
          console.error(`[render] PASO 2 - Error al cargar skin de serum, usando skin base normal`);
          const baseImage = await loadAndRenderSvg(baseImagePath);
          if (baseImage) {
            ctx.drawImage(baseImage, 0, 0, 1000, 1000);
            console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
          }
        }
      }
    }
    // LÓGICA ESPECIAL: Si hay serum fallido, usar el archivo de fallo correspondiente
    else if (serumFailed) {
      console.log(`[render] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum fallido detectado, usando archivo de fallo`);
      
      // Determinar qué archivo de fallo usar según el serum
      let failPath;
      if (failedSerumType === "GoldenAdrian") {
        // GoldenAdrian fallido: verificar si hay AdrianGF previo
        if (hasAdrianGFSerum) {
          failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Goldfail.svg');
        } else {
          failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `GEN${gen}-Goldenfail.svg`);
        }
      } else if (failedSerumType === "AdrianGF") {
        failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
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
        console.log(`[render] PASO 2 - 🧬 Skin ${failedSerumType || 'serum'} fallido renderizado correctamente`);
      } catch (error) {
        console.error(`[render] PASO 2 - Error al cargar skin de fallo, usando skin base normal:`, error.message);
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
        }
      }
    }
    // Si hay un trait de skin excepcional, usarlo en lugar del skin base
    else if (skinTraitPath) {
      console.log(`[render] PASO 2 - Usando skin excepcional: ${skinTraitPath}`);
      const skinImage = await loadAndRenderSvg(skinTraitPath);
      if (skinImage) {
        ctx.drawImage(skinImage, 0, 0, 1000, 1000);
        console.log('[render] PASO 2 - Skin excepcional renderizado correctamente');
      }
    } else {
      // Usar skin base normal o mannequin
      if (useMannequin) {
        console.log('[render] PASO 2 - Usando mannequin.svg (skin no asignado)');
        const mannequinPath = path.join(process.cwd(), 'public', 'labimages', 'mannequin.svg');
        try {
          const svgContent = fs.readFileSync(mannequinPath, 'utf8');
          const resvg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            }
          });
          const pngBuffer = resvg.render().asPng();
          const mannequinImage = await loadImage(pngBuffer);
          ctx.drawImage(mannequinImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Mannequin renderizado correctamente');
        } catch (error) {
          console.error('[render] PASO 2 - Error al cargar mannequin, intentando fallback:', error.message);
          const fallbackPath = `ADRIAN/GEN${gen}-Medium.svg`;
          const fallbackImage = await loadAndRenderSvg(fallbackPath);
          if (fallbackImage) {
            ctx.drawImage(fallbackImage, 0, 0, 1000, 1000);
            console.log('[render] PASO 2 - Skin fallback renderizado correctamente');
          }
        }
      } else {
        console.log('[render] PASO 2 - Usando skin base normal');
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Skin base renderizado correctamente');
        } else {
          console.error('[render] PASO 2 - Error al cargar el skin, intentando fallback');
          const fallbackPath = `ADRIAN/GEN${gen}-Medium.svg`;
          const fallbackImage = await loadAndRenderSvg(fallbackPath);
          if (fallbackImage) {
            ctx.drawImage(fallbackImage, 0, 0, 1000, 1000);
            console.log('[render] PASO 2 - Skin fallback renderizado correctamente');
          }
        }
      }
    }

    // 2.5. RENDERIZAR SKIN TRAITS ESPECIALES (tokens 37, 38) encima del skin base
    console.log('[render] PASO 2.5 - Renderizando skin traits especiales');
    if (equippedTraits['SWAG'] === '37' || equippedTraits['SWAG'] === '38') {
      const skinTraitId = equippedTraits['SWAG'];
      const skinTraitPath = `SKIN/${skinTraitId}.svg`;
      console.log(`[render] PASO 2.5 - Renderizando skin trait especial: ${skinTraitPath}`);
      
      const skinTraitImage = await loadAndRenderSvg(skinTraitPath);
      if (skinTraitImage) {
        ctx.drawImage(skinTraitImage, 0, 0, 1000, 1000);
        console.log(`[render] PASO 2.5 - Skin trait especial ${skinTraitId} renderizado correctamente`);
      }
    }

    // 3. TERCERO: Renderizar resto de traits
    console.log('[render] PASO 3 - Iniciando renderizado de traits adicionales');
    // Nuevo orden de renderizado: HAIR después de SWAG para que se renderice encima
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'HEAD', 'RANDOMSHIT', 'SWAG', 'HAIR', 'HAT', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];

    for (const category of traitOrder) {
      if (equippedTraits[category]) {
        // LÓGICA ESPECIAL: No renderizar HAIR 21 si HEAD 209 está activo
        if (category === 'HAIR' && equippedTraits['HAIR'] === '21' && equippedTraits['HEAD'] === '209') {
          console.log('[render] LÓGICA ESPECIAL: No renderizar HAIR 21 porque HEAD 209 está activo');
          continue;
        }
        // Solo para traits visuales normales (no ADRIAN ni ADRIANGF)
        if (category !== 'ADRIAN' && category !== 'ADRIANGF') {
          // LÓGICA DE EXCLUSIVIDAD: SERUMS solo si NO hay EYES
          if (category === 'SERUMS') {
            const eyesTrait = equippedTraits['EYES'];
            if (eyesTrait && eyesTrait !== 'None' && eyesTrait !== '') {
              console.log(`[render] PASO 3 - 🚫 LÓGICA DE EXCLUSIVIDAD: Saltando SERUMS (${equippedTraits[category]}) porque hay EYES (${eyesTrait}) activado`);
              continue; // Saltar SERUMS si hay EYES activados
            }
          }
          const traitId = equippedTraits[category];
          
          // LÓGICA ESPECIAL: Tokens 30000-35000 usan URL externa
          let traitImage;
          if (traitId >= 30000 && traitId <= 35000) {
            traitImage = await loadExternalTrait(traitId);
            if (traitImage) {
              ctx.drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[render] PASO 3 - 🌐 Trait ${category} (${traitId}) renderizado desde URL externa correctamente`);
            } else {
              console.error(`[render] PASO 3 - 🌐 Error al cargar trait ${category} (${traitId}) desde URL externa`);
            }
          } else if (traitId >= 100001 && traitId <= 101000) {
            traitImage = await loadOgpunkTrait(traitId);
            if (traitImage) {
              ctx.drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[render] PASO 3 - 🎯 LÓGICA OGPUNKS: Trait ${category} (${traitId}) renderizado desde ogpunks correctamente`);
            } else {
              console.error(`[render] PASO 3 - 🎯 LÓGICA OGPUNKS: Error al cargar trait ${category} (${traitId}) desde ogpunks`);
            }
          } else {
            traitImage = await loadTraitFromLabimages(traitId);
            if (traitImage) {
              ctx.drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[render] PASO 3 - Trait ${category} (${traitId}) renderizado desde labimages correctamente`);
            } else {
              console.error(`[render] PASO 3 - Error al cargar trait ${category} (${traitId}) desde labimages`);
            }
          }
        }
      }
    }

    // 4. CUARTO: Renderizar TOP layers (van encima de todas las demás)
    console.log('[render] PASO 4 - Iniciando renderizado de TOP layers');
    const topOrder = ['TOP'];

    for (const category of topOrder) {
      if (equippedTraits[category]) {
        const traitId = equippedTraits[category];
        console.log(`[render] PASO 4 - Cargando TOP trait: ${traitId}`);

        // LÓGICA ESPECIAL: Tokens 30000-35000 usan URL externa
        let traitImage;
        if (traitId >= 30000 && traitId <= 35000) {
          traitImage = await loadExternalTrait(traitId);
          if (traitImage) {
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 4 - 🌐 TOP trait ${category} (${traitId}) renderizado desde URL externa correctamente`);
          } else {
            console.error(`[render] PASO 4 - 🌐 Error al cargar TOP trait ${category} (${traitId}) desde URL externa`);
          }
        } else if (traitId >= 100001 && traitId <= 101000) {
          traitImage = await loadOgpunkTrait(traitId);
          if (traitImage) {
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 4 - 🎯 LÓGICA OGPUNKS: TOP trait ${category} (${traitId}) renderizado desde ogpunks correctamente`);
          } else {
            console.error(`[render] PASO 4 - 🎯 LÓGICA OGPUNKS: Error al cargar TOP trait ${category} (${traitId}) desde ogpunks`);
          }
        } else {
          traitImage = await loadTraitFromLabimages(traitId);
          if (traitImage) {
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 4 - TOP trait ${category} (${traitId}) renderizado desde labimages correctamente`);
          } else {
            console.error(`[render] PASO 4 - Error al cargar TOP trait ${category} (${traitId}) desde labimages`);
          }
        }
      }
    }

    // LÓGICA ESPECIAL: Renderizar token 48 (S.W.A.T-Shild) en TOP
    if (equippedTraits['GEAR'] === '48') {
      const specialTraitPath = `GEAR/48.svg`;
      console.log(`[render] PASO 4 - 🎯 LÓGICA ESPECIAL: Renderizando token 48 en TOP: ${specialTraitPath}`);

      const specialTraitImage = await loadAndRenderSvg(specialTraitPath);
      if (specialTraitImage) {
        ctx.drawImage(specialTraitImage, 0, 0, 1000, 1000);
        console.log(`[render] PASO 4 - 🎯 Token 48 renderizado correctamente en TOP`);
      }
    }

    // ===== GUARDAR EN CACHÉ Y RETORNAR =====
    const buffer = canvas.toBuffer('image/png');
    setCachedAdrianZeroRender(cleanTokenId, buffer);

    const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
    console.log(`[render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${cleanTokenId}`);

    // Configurar headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
    res.setHeader('X-Version', 'ADRIANZERO-CACHED');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    console.log('[render] Renderizado completado exitosamente');

  } catch (error) {
    console.error('[render] Error general:', error);
    console.error('[render] Stack trace:', error.stack);
    
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
    ctx.fillText('Error Rendering', 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText(`Token #${req.query.tokenId?.replace('.png', '') || 'Unknown'}`, 500, 500);
    ctx.font = '18px Arial';
    ctx.fillText(error.message.substring(0, 50), 500, 550);
    
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  }
}
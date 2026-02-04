// API endpoint for rendering tokens by tokenId
// Updated: Banana toggle cache strategy (hybrid approach)
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../lib/contracts.js';
import { 
  getCachedAdrianZeroRender, 
  setCachedAdrianZeroRender, 
  getAdrianZeroRenderTTL,
  getCachedAdrianZeroCloseup,
  setCachedAdrianZeroCloseup
} from '../../../lib/cache.js';
import { getCachedSvgPng, setCachedSvgPng } from '../../../lib/svg-png-cache.js';
import { getCachedComponent, setCachedComponent } from '../../../lib/component-cache.js';
import { updateTogglesIfNeeded, hasToggleActive } from '../../../lib/toggle-cache.js';
import { getTokenDupInfo, getEffectiveGeneration, getDupSkinPathADRIAN, getDupSkinPathADRIANGF } from '../../../lib/duplicator-logic.js';
import { fileExistsInGitHub, uploadFileToGitHub, getRenderType, getGitHubFileUrl, fileExistsInGitHubByHash, getGitHubFileUrlByHash, uploadFileToGitHubByHash, loadLabimagesAsset } from '../../../lib/github-storage.js';
import { transformWithNanoBanana } from '../../../lib/nanobanana-transformer.js';
import { buildNanobananaPrompt } from '../../../lib/nanobanana-prompt.js';
import { generateRenderHash } from '../../../lib/render-hash.js';
import { getAnimatedTraits } from '../../../lib/animated-traits-helper.js';
import { generateGifFromLayers } from '../../../lib/gif-generator.js';
import { getCachedAdrianZeroGif, setCachedAdrianZeroGif } from '../../../lib/cache.js';

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
  } else if (numTokenId >= 100001 && numTokenId <= 101003) {
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

/**
 * Obtiene información de traits desde traits.json basado en los traitIds
 * @param {Array<string|number>} traitIds - Array de IDs de traits equipados
 * @param {Array} traitsArray - Array de traits cargado desde loadMetadataForToken
 * @returns {Array<{name: string, category: string}>} - Array de objetos con name y category de cada trait encontrado
 */
const getTraitsInfo = (traitIds, traitsArray) => {
  if (!traitIds || !Array.isArray(traitIds) || traitIds.length === 0) {
    return [];
  }
  
  if (!traitsArray || !Array.isArray(traitsArray) || traitsArray.length === 0) {
    return [];
  }
  
  const traitsInfo = [];
  
  for (const traitId of traitIds) {
    try {
      const traitIdNum = parseInt(traitId);
      if (isNaN(traitIdNum)) {
        continue;
      }
      
      // Buscar el trait en el array
      const trait = traitsArray.find(t => t.tokenId === traitIdNum);
      
      if (trait && trait.name && trait.category) {
        traitsInfo.push({
          name: trait.name,
          category: trait.category
        });
      }
    } catch (error) {
      // Si hay error procesando un trait, continuar con el siguiente
      console.warn(`[render] Error procesando trait ${traitId}:`, error.message);
      continue;
    }
  }
  
  return traitsInfo;
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
    // Extraer tokenId de la ruta, eliminando .png o .gif si existe
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.toString().replace(/\.(png|gif)$/, '');
    console.log(`[render] Iniciando renderizado para token ${cleanTokenId}`);

    // Verify that tokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[render] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // ===== LÓGICA ESPECIAL BANANA (TOGGLE 13) =====
    // Solo verificamos el toggle 13 (banana) para el almacenamiento en GitHub
    // Si no tiene toggle 13, se renderiza normalmente sin cambios
    let isBanana = false;
    
    try {
      // Actualizar toggles si es necesario (automático cada 24h)
      const { zoomInZeros } = await getContracts();
      await updateTogglesIfNeeded(zoomInZeros);
      
      // Verificar solo el toggle 13 (banana)
      isBanana = hasToggleActive(cleanTokenId, "13"); // toggleId "13" = banana
      
      if (isBanana) {
        console.log(`[render] 🍌 TOGGLE: Token ${cleanTokenId} tiene BANANA activo`);
      }
    } catch (error) {
      console.error(`[render] ⚠️ Error verificando toggle banana para token ${cleanTokenId}:`, error.message);
      // En caso de error, no aplicar banana (fallback seguro)
      isBanana = false;
    }
    
    // ===== LÓGICA ESPECIAL CLOSEUP, SHADOW, GLOW, BN, UV, BLACKOUT, BOUNCE Y MESSAGES (PARÁMETROS) =====
    // Estos se mantienen como parámetros de query (no se verifican onchain aquí)
    const isCloseup = req.query.closeup === 'true';
    const isShadow = req.query.shadow === 'true';
    const isGlow = req.query.glow === 'true';
    const isBn = req.query.bn === 'true' || req.query.bw === 'true'; // bn o bw para blanco y negro
    const isUv = req.query.uv === 'true' || req.query.UV === 'true'; // uv o UV (case-insensitive)
    const isBlackout = req.query.blackout === 'true';
    const isBounce = req.query.bounce === 'true';
    const messageText = req.query.messages ? decodeURIComponent(req.query.messages) : null;
    const bounceConfig = isBounce ? {
      enabled: true,
      direction: req.query.bounceDir || 'y',
      distance: parseFloat(req.query.bounceDist) || 50,
      bounces: parseInt(req.query.bounceCount) || 3,
      frames: parseInt(req.query.bounceFrames) || 12,
      delay: parseInt(req.query.bounceDelay) || 2
    } : null;
    
    if (isCloseup) {
      console.log(`[render] 🔍 CLOSEUP: Token ${cleanTokenId} - Renderizando closeup 640x640`);
    }
    
    if (isShadow) {
      console.log(`[render] 🌑 SHADOW: Token ${cleanTokenId} - Renderizando con sombra`);
    }
    
    if (isGlow) {
      console.log(`[render] ✨ GLOW: Token ${cleanTokenId} - Renderizando con glow`);
    }
    
    if (isBn) {
      console.log(`[render] ⚫ BN: Token ${cleanTokenId} - Renderizando en blanco y negro`);
    }
    
    if (isUv) {
      console.log(`[render] 💜 UV: Token ${cleanTokenId} - Renderizando con efecto UV/Blacklight`);
    }
    
    if (isBlackout) {
      console.log(`[render] ⬛ BLACKOUT: Token ${cleanTokenId} - Renderizando con blackout (negro completo)`);
    }
    
    if (messageText) {
      console.log(`[render] 💬 MESSAGES: Token ${cleanTokenId} - Renderizando con mensaje: "${messageText}"`);
    }

    // ===== SISTEMA DE CACHÉ PARA ADRIANZERO RENDER =====
    // El caché debe diferenciar según los efectos (shadow, glow, bn, uv, blackout, messages)
    let cachedImage;
    
    if (isCloseup) {
      cachedImage = getCachedAdrianZeroCloseup(cleanTokenId, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
    } else {
      cachedImage = getCachedAdrianZeroRender(cleanTokenId, isShadow, isGlow, isBn, isUv, isBlackout, isBanana, messageText);
    }
    
    if (cachedImage) {
      console.log(`[render] 🎯 CACHE HIT para token ${cleanTokenId}${isCloseup ? ' (CLOSEUP)' : ''}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'image/png');
      
      const versionParts = [];
      if (isCloseup) versionParts.push('CLOSEUP');
      if (isShadow) versionParts.push('SHADOW');
      if (isGlow) versionParts.push('GLOW');
      if (isBn) versionParts.push('BN');
      if (isUv) versionParts.push('UV');
      if (isBlackout) versionParts.push('BLACKOUT');
      if (isBanana) versionParts.push('BANANA');
      if (messageText) versionParts.push('MESSAGES');
      const versionSuffix = versionParts.length > 0 ? `-${versionParts.join('-')}` : '';
      
      if (isCloseup) {
        res.setHeader('X-Version', `ADRIANZERO-CLOSEUP${versionSuffix}-CACHED`);
        res.setHeader('X-Render-Type', 'closeup');
      } else {
        res.setHeader('X-Version', `ADRIANZERO${versionSuffix}-CACHED`);
        res.setHeader('X-Render-Type', 'full');
      }
      
      if (isShadow) {
        res.setHeader('X-Shadow', 'enabled');
      }
      
      if (isGlow) {
        res.setHeader('X-Glow', 'enabled');
      }
      
      if (isBn) {
        res.setHeader('X-BN', 'enabled');
      }
      
      if (isUv) {
        res.setHeader('X-UV', 'enabled');
      }
      
      if (isBlackout) {
        res.setHeader('X-Blackout', 'enabled');
      }
      
      if (isBanana) {
        res.setHeader('X-Banana', 'enabled');
      }
      
      if (messageText) {
        res.setHeader('X-Messages', 'enabled');
      }
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[render] 💾 CACHE MISS para token ${cleanTokenId} - Generando imagen...`);

    // ===== VERIFICAR SI EL ARCHIVO YA EXISTE EN GITHUB (SOLO SI TIENE TOGGLE 13) =====
    // ESTRATEGIA HÍBRIDA: Primero verificar nombre fijo (compatibilidad), luego hash (nuevo sistema)
    // Si tiene toggle 13 (banana) activo, verificar si el archivo ya está almacenado en GitHub
    // DEPLOY: 2025-01-19 - Banana toggle cache fix with hybrid strategy
    // NOTA: Si hay mensaje, NO usar el archivo de banana sin mensaje - debe generar uno nuevo
    if (isBanana && !messageText) {
      const renderType = 'banana'; // Siempre 'banana' cuando tiene toggle 13
      
      // PASO 1: Verificar si existe archivo con nombre fijo (compatibilidad hacia atrás)
      const existsInGitHubFixedName = await fileExistsInGitHub(cleanTokenId, renderType);
      
      if (existsInGitHubFixedName) {
        console.log(`[render] 📦 Archivo con nombre fijo existe en GitHub para token ${cleanTokenId} (${renderType}) - Usando compatibilidad hacia atrás`);
        
        // Obtener URL del archivo en GitHub
        const githubUrl = getGitHubFileUrl(cleanTokenId, renderType);
        
        // Descargar y servir desde GitHub
        try {
          const response = await fetch(githubUrl);
          if (response.ok) {
            const imageBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);
            
            // Guardar en caché local para próximas peticiones
            if (isCloseup) {
              setCachedAdrianZeroCloseup(cleanTokenId, buffer, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
            } else {
              setCachedAdrianZeroRender(cleanTokenId, buffer, isShadow, isGlow, isBn, isUv, isBlackout, isBanana, messageText);
            }
            
            const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
            res.setHeader('X-Cache', 'GITHUB');
            res.setHeader('X-GitHub-Source', 'true');
            res.setHeader('X-Banana-Source', 'fixed-name'); // Indicar que viene de nombre fijo
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
            
            const versionParts = [];
            if (isCloseup) versionParts.push('CLOSEUP');
            if (isShadow) versionParts.push('SHADOW');
            if (isGlow) versionParts.push('GLOW');
            if (isBn) versionParts.push('BN');
            if (isUv) versionParts.push('UV');
            if (isBlackout) versionParts.push('BLACKOUT');
            if (isBanana) versionParts.push('BANANA');
            const versionSuffix = versionParts.length > 0 ? `-${versionParts.join('-')}` : '';
            
            if (isCloseup) {
              res.setHeader('X-Version', `ADRIANZERO-CLOSEUP${versionSuffix}-GITHUB-LEGACY`);
              res.setHeader('X-Render-Type', 'closeup');
            } else {
              res.setHeader('X-Version', `ADRIANZERO${versionSuffix}-GITHUB-LEGACY`);
              res.setHeader('X-Render-Type', 'full');
            }
            
            return res.status(200).send(buffer);
          }
        } catch (error) {
          console.error(`[render] ⚠️ Error descargando desde GitHub (nombre fijo), continuando con verificación de hash:`, error.message);
          // Continuar con verificación de hash si falla la descarga del nombre fijo
        }
      } else {
        console.log(`[render] 📤 Archivo con nombre fijo no existe en GitHub para token ${cleanTokenId} (${renderType}) - Se verificará con hash después de obtener datos del token`);
        // Continuar con el flujo normal - la verificación con hash se hará después de generar el hash
      }
    }

    // ===== LÓGICA ESPECIAL SAMURAIZERO (500-1099) - PAUSADA =====
    // const tokenIdNum = parseInt(cleanTokenId);
    // if (tokenIdNum >= 500 && tokenIdNum <= 1099) {
    //   console.log(`[render] 🥷 SAMURAIZERO: Token ${cleanTokenId} detectado - Usando lógica simplificada`);
    //   ... (lógica pausada)
    // }

    // ===== LÓGICA NORMAL ADRIANZERO (0-499, 1100+) =====
    console.log(`[render] 🎯 ADRIANZERO: Token ${cleanTokenId} - Usando lógica normal`);

    // Conectar con los contratos
    console.log('[render] Conectando con los contratos...');
    const { core, traitsExtension, patientZero, serumModule, duplicatorModule } = await getContracts();

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

    // Crear canvas con fondo blanco (3000x1000 si hay mensaje, 1000x1000 normal)
    const canvasWidth = messageText ? 3000 : 1000;
    const canvasHeight = 1000;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    console.log(`[render] Canvas creado con fondo blanco (${canvasWidth}x${canvasHeight})`);
    
    // Registrar fuente ADRIAN_ZERO si hay mensaje
    if (messageText) {
      try {
        const fontPath = path.join(process.cwd(), 'public', 'fonts', 'ADRIAN_ZERO.otf');
        registerFont(fontPath, { family: 'AdrianZERO' });
        console.log('[render] 💬 Fuente ADRIAN_ZERO registrada correctamente');
      } catch (error) {
        console.error('[render] 💬 Error registrando fuente ADRIAN_ZERO:', error.message);
      }
    }

    // Canvas intermedio para renderizar todas las capas excepto el BACKGROUND (solo si shadow, glow o blackout está activo)
    let contentCanvas = null;
    let contentCtx = null;
    if (isShadow || isGlow || isBlackout) {
      contentCanvas = createCanvas(canvasWidth, canvasHeight);
      contentCtx = contentCanvas.getContext('2d');
      const effectName = isShadow ? 'sombra' : (isGlow ? 'glow' : 'blackout');
      console.log(`[render] Canvas de contenido (sin background) creado para ${effectName} (${canvasWidth}x${canvasHeight})`);
    }

    // Nota: GLOW se dibuja directamente en el canvas principal (1000x1000)
    // Las capas de glow se extienden más allá del borde pero se recortan automáticamente

    // Función auxiliar para obtener el contexto correcto según shadow, glow o blackout
    const getDrawContext = () => (isShadow || isGlow || isBlackout) ? contentCtx : ctx;

    // Función para cargar y renderizar SVG con caché
    const loadAndRenderSvg = async (path) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/traits/${path}`;
        console.log(`[render] Cargando imagen: ${imageUrl}`);
 
        let response = await fetch(imageUrl);
        if (!response.ok) {
          // Fallback: si el nombre del archivo es numérico (e.g., BACKGROUND/663.svg), intentar en /labimages/<id>.svg
          const filename = path.split('/').pop() || '';
          const numericId = filename.replace(/\.svg$/i, '');
          if (/^\d+$/.test(numericId)) {
            const fallbackUrl = `${baseUrl}/labimages/${numericId}.svg`;
            console.log(`[render] Fallback labimages: ${fallbackUrl}`);
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

    // NUEVA FUNCIÓN: Cargar directamente desde labimages/ usando solo traitId (con fallback a GitHub)
    const loadTraitFromLabimages = async (traitId) => {
      try {
        const assetPath = `${traitId}.svg`;
        const svgBuffer = await loadLabimagesAsset(assetPath);
        
        if (!svgBuffer) {
          throw new Error(`Asset no encontrado: ${assetPath}`);
        }
        
        const svgContent = svgBuffer;
        console.log(`[render] Cargando trait desde labimages (con fallback GitHub): ${assetPath}`);
        
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

    // NUEVA FUNCIÓN: Cargar trait desde ogpunks para tokens 100001-101003 (con fallback a GitHub)
    const loadOgpunkTrait = async (traitId) => {
      try {
        const assetPath = `ogpunks/${traitId}.svg`;
        const svgBuffer = await loadLabimagesAsset(assetPath);
        
        if (!svgBuffer) {
          throw new Error(`Asset no encontrado: ${assetPath}`);
        }
        
        const svgContent = svgBuffer;
        console.log(`[render] 🎯 LÓGICA OGPUNKS: Cargando trait ${traitId} desde ogpunks (con fallback GitHub): ${assetPath}`);
        
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

    // ===== OBTENER INFORMACIÓN DE DUPLICACIÓN =====
    let dupInfo = null;
    try {
      dupInfo = await getTokenDupInfo(duplicatorModule, cleanTokenId);
      if (dupInfo && dupInfo.duplicated) {
        console.log(`[render] 🔄 DUPLICATOR: Token ${cleanTokenId} está duplicado (dupNumber=${dupInfo.dupNumber}, sourceId=${dupInfo.sourceId})`);
      }
    } catch (error) {
      console.error(`[render] ⚠️ Error obteniendo dupInfo para token ${cleanTokenId}:`, error.message);
      // Continuar sin info de duplicación
    }

    // ===== HEREDAR SKIN DEL PADRE SI ES DUPLICADO Y NO TIENE SKIN ASIGNADO =====
    // Los tokens duplicados tienen skinId=0 por defecto, pero deben heredar el skin del padre
    let effectiveSkinId = skinId;
    let effectiveSkinName = skinName;

    if (dupInfo && dupInfo.duplicated && skinId.toString() === "0" && dupInfo.sourceId) {
      try {
        console.log(`[render] 🔄 DUPLICATOR: Token duplicado sin skin asignado, obteniendo skin del padre (sourceId=${dupInfo.sourceId})`);
        const parentSkinData = await core.getTokenSkin(parseInt(dupInfo.sourceId));
        effectiveSkinId = parentSkinData[0].toString();
        effectiveSkinName = parentSkinData[1];
        console.log(`[render] 🔄 DUPLICATOR: Skin heredado del padre: skinId=${effectiveSkinId}, skinName=${effectiveSkinName}`);
      } catch (error) {
        console.error(`[render] ⚠️ Error obteniendo skin del padre (sourceId=${dupInfo.sourceId}):`, error.message);
        // Continuar con el skin original (0)
      }
    }

    // Determinar la imagen base según generación y skin
    // Si el token está duplicado, usar dupNumber como generación efectiva
    const gen = getEffectiveGeneration(dupInfo, generation);
    let baseImagePath;

    // Mapear skin para determinar la imagen a mostrar
    let skinType;
    let useMannequin = false;

    console.log('[render] Analizando skin:', {
      skinId: effectiveSkinId,
      skinName: effectiveSkinName,
      generacion: gen,
      inherited: effectiveSkinId !== skinId
    });
    
    // Lógica del skin basada en el contrato:
    // - skinId = 0: No hay skin asignado (usar mannequin.svg)
    // - skinId = 1: Skin "Zero" (usar Medium)
    // - skinId = 2: Skin "Dark" (usar Dark)
    // - skinId = 3: Skin "Alien" (usar Alien)
    // - skinId = 4: Skin "Albino" (usar Albino)
    if (effectiveSkinId.toString() === "0") {
      useMannequin = true;
      console.log('[render] Skin no asignado detectado (skinId = 0), usando mannequin.svg');
    } else if (effectiveSkinId.toString() === "1" || effectiveSkinName === "Zero") {
      skinType = "Medium";
      console.log('[render] Skin Zero detectado (skinId = 1), usando Medium');
    } else if (effectiveSkinId.toString() === "2" || effectiveSkinName === "Dark") {
      skinType = "Dark";
      console.log('[render] Skin Dark detectado (skinId = 2), usando Dark');
    } else if (effectiveSkinId.toString() === "3" || effectiveSkinName === "Alien") {
      skinType = "Alien";
      console.log('[render] Skin Alien detectado (skinId = 3), usando Alien');
    } else if (effectiveSkinId.toString() === "4" || effectiveSkinName === "Albino") {
      skinType = "Albino";
      console.log('[render] Skin Albino detectado (skinId = 4), usando Albino');
    } else {
      skinType = effectiveSkinName || "Medium";
      console.log(`[render] Skin personalizado detectado: ${effectiveSkinName} (skinId = ${effectiveSkinId})`);
    }

    // Construir path del Adrian base (solo si no usamos mannequin)
    if (!useMannequin) {
      baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
    }
    console.log('[render] Path de imagen base:', baseImagePath);
    console.log('[render] Mapeo aplicado:', {
      skinId: effectiveSkinId,
      skinName: effectiveSkinName,
      skinTypeSeleccionado: skinType,
      inheritedFromParent: effectiveSkinId !== skinId
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

    // ===== DETECCIÓN DE TRAITS ANIMADOS =====
    // Obtener lista de traitIds para detectar animados
    const allTraitIds = Object.values(equippedTraits).filter(id => id && id !== 'None' && id !== '');
    const animatedTraits = await getAnimatedTraits(allTraitIds);
    const hasAnimatedTraits = animatedTraits.length > 0;
    
    if (hasAnimatedTraits) {
      console.log(`[render] 🎬 Traits animados detectados: ${animatedTraits.length}`);
      animatedTraits.forEach((at, i) => {
        console.log(`[render] 🎬   Animated ${i + 1}: ${at.baseId} (${at.variants.length} variantes)`);
      });
      
      // Verificar caché de GIF (usando equippedTraits, que se modificará después si es necesario)
      // Nota: equippedTraits puede modificarse después (SubZERO, SamuraiZERO), pero la detección de animados
      // se hace antes. El caché se actualizará con equippedTraits final cuando se guarde.
      const cachedGif = getCachedAdrianZeroGif(cleanTokenId, equippedTraits, bounceConfig);
      if (cachedGif) {
        console.log(`[render] 🎬 CACHE HIT para GIF de token ${cleanTokenId}`);
        const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        res.setHeader('X-Version', 'ADRIANZERO-ANIMATED');
        return res.status(200).send(cachedGif);
      }
      
      console.log(`[render] 🎬 CACHE MISS para GIF - Generando GIF animado...`);
    }

    // ===== LÓGICA DE TAGS (SubZERO, SamuraiZERO, etc.) - ANTES de cualquier lógica de skin =====
    const { getTokenTagInfo, filterEyesForTag, forceSkinTraitForTag, getSamuraiZEROIndex, TAG_CONFIGS } = await import('../../../lib/tag-logic.js');
    const tagInfo = await getTokenTagInfo(cleanTokenId);
    
    if (tagInfo.tag === 'SubZERO') {
      console.log(`[render] 🏷️ Token ${cleanTokenId} tiene tag SubZERO - Aplicando lógica especial`);
      console.log(`[render] 🏷️ SubZERO: Traits antes de aplicar lógica:`, equippedTraits);
      
      // Filtrar EYES (solo permitir 1124) - preserva todos los demás traits
      const filteredTraits = filterEyesForTag(equippedTraits, tagInfo.tag);
      console.log(`[render] 🏷️ SubZERO: Traits después de filtrar EYES:`, filteredTraits);
      
      // Forzar SKINTRAIT 1125 con prioridad absoluta - aplica sobre los traits filtrados
      const forcedTraits = forceSkinTraitForTag(filteredTraits, tagInfo.tag);
      console.log(`[render] 🏷️ SubZERO: Traits después de forzar SKINTRAIT:`, forcedTraits);
      
      // Actualizar equippedTraits con el resultado final (preserva todos los traits + SKINTRAIT)
      Object.keys(equippedTraits).forEach(key => delete equippedTraits[key]);
      Object.assign(equippedTraits, forcedTraits);
      
      console.log(`[render] 🏷️ SubZERO: EYES filtrado, SKINTRAIT 1125 forzado con prioridad absoluta`);
      console.log(`[render] 🏷️ SubZERO: Traits finales:`, equippedTraits);
    }
    
    // ===== LÓGICA ESPECIAL SAMURAIZERO =====
    let samuraiIndex = null; // Variable para almacenar el índice y reutilizarlo después
    if (tagInfo.tag === 'SamuraiZERO') {
      console.log(`[render] 🥷 Token ${cleanTokenId} tiene tag SamuraiZERO - Aplicando lógica especial`);
      
      samuraiIndex = await getSamuraiZEROIndex(cleanTokenId);
      
      if (samuraiIndex !== null && samuraiIndex >= 0 && samuraiIndex < 600) {
        const imageIndex = TAG_CONFIGS.SamuraiZERO.imageBaseIndex + samuraiIndex;
        console.log(`[render] 🥷 SamuraiZERO token ${cleanTokenId} tiene índice ${samuraiIndex}, usando imagen ${imageIndex}.svg como TOP`);
        
        // Forzar trait TOP con la imagen de SamuraiZERO
        equippedTraits['TOP'] = imageIndex.toString();
        
        console.log(`[render] 🥷 SamuraiZERO: TOP ${imageIndex} forzado, se renderizará sobre todo lo demás`);
      } else {
        console.error(`[render] 🥷 SamuraiZERO token ${cleanTokenId} tiene índice inválido: ${samuraiIndex}`);
      }
    }

    // Verificar si hay un trait de skin excepcional
    let skinTraitPath = null;
    if (equippedTraits['SKIN']) {
      skinTraitPath = getSkinTraitPath(equippedTraits['SKIN'], gen);
      if (skinTraitPath) {
        console.log(`[render] Detectado trait de skin excepcional: ${skinTraitPath}`);
      }
    }

    // LÓGICA ESPECIAL: Verificar si hay SKINTRAIT que prevalezca sobre el skin base
    let skintraitPath = null;
    if (equippedTraits['SKINTRAIT']) {
      skintraitPath = `SKINTRAIT/${equippedTraits['SKINTRAIT']}.svg`;
      console.log(`[render] LÓGICA ESPECIAL: SKINTRAIT detectado (${equippedTraits['SKINTRAIT']}) - prevalecerá sobre skin base y serums`);
    }

    // LÓGICA ESPECIAL: Detectar serum aplicado y cambiar skin base
    // Si es duplicado, obtener serum del token padre (sourceId)
    let appliedSerum = null; // Solo para serums exitosos
    let serumFailed = false;
    let failedSerumType = null; // Nueva variable para el tipo de serum que falló
    let hasAdrianGFSerum = false; // Flag para verificar si el serum es AdrianGF
    let serumHistory = null; // Historial completo para conversiones posteriores
    try {
      // Determinar de qué token obtener el historial de serums
      // Si es duplicado, usar el sourceId del padre
      const serumSourceTokenId = (dupInfo && dupInfo.duplicated && dupInfo.sourceId) ? dupInfo.sourceId : cleanTokenId;

      if (dupInfo && dupInfo.duplicated && dupInfo.sourceId) {
        console.log(`[render] 🔄 DUPLICATOR: Token duplicado, obteniendo serum del padre (sourceId=${dupInfo.sourceId})`);
      }

      console.log('[render] Verificando si hay serum aplicado...');
      serumHistory = await serumModule.getTokenSerumHistory(serumSourceTokenId);
      
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

    // ===== GENERAR HASH Y VERIFICAR EN GITHUB =====
    // Generar hash único basado en todas las variables que afectan al render
    // Esto debe hacerse después de obtener todos los datos del contrato y procesar tags
    console.log('[render] 🔐 Generando hash único para el render...');
    
    // Obtener skintraitId si existe (después de aplicar lógica de tags)
    const skintraitId = equippedTraits['SKINTRAIT'] || null;
    
    // Obtener tagIndex si es SamuraiZERO (ya se calculó arriba)
    const tagIndex = samuraiIndex; // Reutilizar el samuraiIndex que ya se calculó
    
    // IMPORTANTE: Usar equippedTraits finales (después de aplicar lógica de tags)
    // en lugar de categories/traitIds del contrato, para incluir SKINTRAIT forzado y otros cambios
    const finalCategories = [];
    const finalTraitIds = [];
    
    // Ordenar las categorías para consistencia en el hash
    const sortedCategories = Object.keys(equippedTraits).sort();
    for (const category of sortedCategories) {
      // Incluir todas las categorías excepto SKINTRAIT (que se incluye por separado)
      if (category !== 'SKINTRAIT') {
        finalCategories.push(category);
        finalTraitIds.push(equippedTraits[category].toString());
      }
    }
    
    console.log('[render] 🔐 Traits finales para hash:', {
      categories: finalCategories,
      traitIds: finalTraitIds,
      skintraitId,
      tag: tagInfo.tag
    });
    
    const renderHash = generateRenderHash({
      // Query parameters
      closeup: isCloseup,
      shadow: isShadow,
      glow: isGlow,
      bn: isBn,
      uv: isUv,
      blackout: isBlackout,
      // Si hay messageText, NO considerar banana en el hash (no se aplicará la transformación)
      banana: isBanana && !messageText,
      messages: messageText,

      // Token data
      generation: generation.toString(),
      mutationLevel: mutationLevel.toString(),
      canReplicate,
      hasBeenModified,

      // Skin
      skinId: skinId.toString(),
      skinName,

      // Traits (usar equippedTraits finales, no los del contrato)
      traitCategories: finalCategories,
      traitIds: finalTraitIds,

      // Serum
      appliedSerum,
      serumFailed,
      failedSerumType,
      hasAdrianGFSerum,
      serumHistory,

      // SKINTRAIT (incluido por separado, puede ser forzado por tags)
      skintraitId: skintraitId ? skintraitId.toString() : null,

      // Tags
      tag: tagInfo.tag,
      tagIndex,

      // Duplicator
      duplicated: dupInfo ? dupInfo.duplicated : false,
      dupNumber: dupInfo ? dupInfo.dupNumber : 0
    });
    
    console.log(`[render] 🔐 Hash generado: ${renderHash}`);
    
    // Verificar si el archivo ya existe en GitHub usando hash
    // Para banana: solo verificar hash si NO se encontró archivo con nombre fijo (ya se verificó antes)
    // Para otros renders: siempre verificar hash
    // Si es banana y tiene messageText, no verificar (se renderizará nuevo)
    if (!isBanana || (isBanana && !messageText)) {
      const existsInGitHub = await fileExistsInGitHubByHash(cleanTokenId, renderHash);
      
      if (existsInGitHub) {
        console.log(`[render] 📦 Archivo con hash ${renderHash} ya existe en GitHub - Descargando y sirviendo...`);
        
        // Obtener URL del archivo en GitHub
        const githubUrl = getGitHubFileUrlByHash(cleanTokenId, renderHash);
        
        // Descargar y servir desde GitHub
        try {
          const response = await fetch(githubUrl);
          if (response.ok) {
            const imageBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);
            
            // Guardar en caché local para próximas peticiones
            if (isCloseup) {
              setCachedAdrianZeroCloseup(cleanTokenId, buffer, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
            } else {
              setCachedAdrianZeroRender(cleanTokenId, buffer, isShadow, isGlow, isBn, isUv, isBlackout, isBanana, messageText);
            }
            
            const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
            res.setHeader('X-Cache', 'GITHUB');
            res.setHeader('X-GitHub-Source', 'true');
            res.setHeader('X-Render-Hash', renderHash);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
            
            const versionParts = [];
            if (isCloseup) versionParts.push('CLOSEUP');
            if (isShadow) versionParts.push('SHADOW');
            if (isGlow) versionParts.push('GLOW');
            if (isBn) versionParts.push('BN');
            if (isUv) versionParts.push('UV');
            if (isBlackout) versionParts.push('BLACKOUT');
            if (isBanana) versionParts.push('BANANA');
            const versionSuffix = versionParts.length > 0 ? `-${versionParts.join('-')}` : '';
            
            if (isCloseup) {
              res.setHeader('X-Version', `ADRIANZERO-CLOSEUP${versionSuffix}-GITHUB`);
              res.setHeader('X-Render-Type', 'closeup');
            } else {
              res.setHeader('X-Version', `ADRIANZERO${versionSuffix}-GITHUB`);
              res.setHeader('X-Render-Type', 'full');
            }
            
            console.log(`[render] ✅ Archivo servido desde GitHub (hash: ${renderHash})`);
            return res.status(200).send(buffer);
          }
        } catch (error) {
          console.error(`[render] ⚠️ Error descargando desde GitHub, continuando con renderizado:`, error.message);
          // Continuar con el renderizado normal si falla la descarga
        }
      } else {
        console.log(`[render] 📤 Archivo con hash ${renderHash} no existe en GitHub - Se renderizará y subirá`);
      }
    }

    // Generar PNG estático (eliminada lógica de animaciones)
    console.log('[render] Generando PNG estático...');

    // 1. PRIMERO: Renderizar BACKGROUND si existe
    if (equippedTraits['BACKGROUND']) {
      const bgPath = `BACKGROUND/${equippedTraits['BACKGROUND']}.svg`;
      console.log(`[render] PASO 1 - Cargando background: ${bgPath}`);
      
      const bgImage = await loadAndRenderSvg(bgPath);
      if (bgImage) {
        // Si hay mensaje, estirar el background horizontalmente a 3000px
        if (messageText) {
          ctx.drawImage(bgImage, 0, 0, 3000, 1000);
          console.log('[render] PASO 1 - Background renderizado y estirado a 3000x1000 correctamente');
        } else {
          ctx.drawImage(bgImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 1 - Background renderizado correctamente');
        }
      }
    }

    // 2. SEGUNDO: Renderizar el SKIN (Adrian base, excepción o serum)
    console.log('[render] PASO 2 - Iniciando carga del skin');
    
    // LÓGICA ESPECIAL: SKINTRAIT tiene máxima prioridad sobre todo
    if (skintraitPath) {
      console.log(`[render] PASO 2 - 🎨 LÓGICA ESPECIAL: SKINTRAIT prevalece sobre skin base y serums: ${skintraitPath}`);
      const skintraitImage = await loadAndRenderSvg(skintraitPath);
      if (skintraitImage) {
        getDrawContext().drawImage(skintraitImage, 0, 0, 1000, 1000);
        console.log('[render] PASO 2 - 🎨 SKINTRAIT renderizado correctamente (reemplaza skin base)');
      } else {
        console.error('[render] PASO 2 - Error al cargar SKINTRAIT, usando skin base normal');
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          getDrawContext().drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
        }
      }
    }
    // LÓGICA ESPECIAL: Si hay serum aplicado, usar el skin del serum
    else if (appliedSerum) {
      console.log(`[render] PASO 2 - 🧬 LÓGICA ESPECIAL: Usando skin de serum aplicado: ${appliedSerum}`);
      
      // LÓGICA ESPECIAL: GoldenAdrian prevalece sobre AdrianGF
      if (appliedSerum === "GoldenAdrian") {
        // GoldenAdrian exitoso: usar skin Golden específico
        const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
        if (serumSkinImage) {
          getDrawContext().drawImage(serumSkinImage, 0, 0, 1000, 1000);
          console.log(`[render] PASO 2 - 🧬 Skin GoldenAdrian exitoso (GEN${gen}, Golden) renderizado correctamente`);
        } else {
          console.error(`[render] PASO 2 - Error al cargar skin GoldenAdrian exitoso, usando skin base normal`);
          const baseImage = await loadAndRenderSvg(baseImagePath);
          if (baseImage) {
            getDrawContext().drawImage(baseImage, 0, 0, 1000, 1000);
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
                  getDrawContext().drawImage(failImage, 0, 0, 1000, 1000);
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
                  getDrawContext().drawImage(serumSkinImage, 0, 0, 1000, 1000);
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
            getDrawContext().drawImage(serumSkinImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 2 - 🧬 Skin ADRIANGF exitoso (GEN${gen}, ${skinType}) renderizado correctamente`);
          } else {
            console.error(`[render] PASO 2 - Error al cargar skin ADRIANGF exitoso, usando skin base normal`);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              getDrawContext().drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        }
      } else {
        // Otros serums: lógica original
        const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
        if (serumSkinImage) {
          getDrawContext().drawImage(serumSkinImage, 0, 0, 1000, 1000);
          console.log(`[render] PASO 2 - 🧬 Skin de serum ${appliedSerum} renderizado correctamente`);
        } else {
          console.error(`[render] PASO 2 - Error al cargar skin de serum, usando skin base normal`);
          const baseImage = await loadAndRenderSvg(baseImagePath);
          if (baseImage) {
            getDrawContext().drawImage(baseImage, 0, 0, 1000, 1000);
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
        getDrawContext().drawImage(failImage, 0, 0, 1000, 1000);
        console.log(`[render] PASO 2 - 🧬 Skin ${failedSerumType || 'serum'} fallido renderizado correctamente`);
      } catch (error) {
        console.error(`[render] PASO 2 - Error al cargar skin de fallo, usando skin base normal:`, error.message);
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          getDrawContext().drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Skin base renderizado correctamente (fallback)');
        }
      }
    }
    // Si hay un trait de skin excepcional, usarlo en lugar del skin base
    else if (skinTraitPath) {
      console.log(`[render] PASO 2 - Usando skin excepcional: ${skinTraitPath}`);
      const skinImage = await loadAndRenderSvg(skinTraitPath);
      if (skinImage) {
        getDrawContext().drawImage(skinImage, 0, 0, 1000, 1000);
        console.log('[render] PASO 2 - Skin excepcional renderizado correctamente');
      }
    } else {
      // Usar skin base normal o mannequin
      if (useMannequin) {
        console.log('[render] PASO 2 - Usando mannequin.svg (skin no asignado)');
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
          const mannequinUrl = `${baseUrl}/labimages/mannequin.svg`;
          const r = await fetch(mannequinUrl);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const svgContent = await r.text();
          const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1000 } });
          const pngBuffer = resvg.render().asPng();
          const mannequinImage = await loadImage(pngBuffer);
          getDrawContext().drawImage(mannequinImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Mannequin renderizado correctamente');
        } catch (error) {
          console.error('[render] PASO 2 - Error al cargar mannequin, intentando fallback:', error.message);
          const fallbackPath = `ADRIAN/GEN${gen}-Medium.svg`;
          const fallbackImage = await loadAndRenderSvg(fallbackPath);
          if (fallbackImage) {
            getDrawContext().drawImage(fallbackImage, 0, 0, 1000, 1000);
            console.log('[render] PASO 2 - Skin fallback renderizado correctamente');
          }
        }
      } else {
        console.log('[render] PASO 2 - Usando skin base normal');
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          getDrawContext().drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[render] PASO 2 - Skin base renderizado correctamente');
        } else {
          console.error('[render] PASO 2 - Error al cargar el skin, intentando fallback');
          const fallbackPath = `ADRIAN/GEN${gen}-Medium.svg`;
          const fallbackImage = await loadAndRenderSvg(fallbackPath);
          if (fallbackImage) {
            getDrawContext().drawImage(fallbackImage, 0, 0, 1000, 1000);
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
        getDrawContext().drawImage(skinTraitImage, 0, 0, 1000, 1000);
        console.log(`[render] PASO 2.5 - Skin trait especial ${skinTraitId} renderizado correctamente`);
      }
    }

    // 3. TERCERO: Renderizar resto de traits
    console.log('[render] PASO 3 - Iniciando renderizado de traits adicionales');
    
    // LÓGICA ESPECIAL: Renderizar GEAR 721 y 726 ANTES de SWAG (excepciones)
    if (equippedTraits['GEAR'] === '721' || equippedTraits['GEAR'] === '726') {
      const gearTraitId = equippedTraits['GEAR'];
      console.log(`[render] PASO 3 - 🎯 LÓGICA ESPECIAL: Renderizando GEAR ${gearTraitId} ANTES de SWAG`);
      const gearTraitImage = await loadTraitFromLabimages(gearTraitId);
      if (gearTraitImage) {
        getDrawContext().drawImage(gearTraitImage, 0, 0, 1000, 1000);
        console.log(`[render] PASO 3 - GEAR ${gearTraitId} renderizado antes de SWAG correctamente`);
      }
    }
    
    // Ajuste: HEAD por encima de HAIR, GEAR después de SWAG (excepto 721 y 726 que ya se renderizaron)
    const traitOrder = ['BEARD', 'EAR', 'RANDOMSHIT', 'SWAG', 'GEAR', 'HAIR', 'HAT', 'HEAD', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];

    for (const category of traitOrder) {
      if (equippedTraits[category]) {
        // LÓGICA ESPECIAL: No renderizar HAIR 21 si HEAD 209 está activo
        if (category === 'HAIR' && equippedTraits['HAIR'] === '21' && equippedTraits['HEAD'] === '209') {
          console.log('[render] LÓGICA ESPECIAL: No renderizar HAIR 21 porque HEAD 209 está activo');
          continue;
        }
        // LÓGICA ESPECIAL: Saltar GEAR 721 y 726 si ya se renderizaron antes de SWAG
        if (category === 'GEAR' && (equippedTraits['GEAR'] === '721' || equippedTraits['GEAR'] === '726')) {
          console.log(`[render] PASO 3 - 🎯 LÓGICA ESPECIAL: Saltando GEAR ${equippedTraits['GEAR']} porque ya se renderizó antes de SWAG`);
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
          
          // LÓGICA ANIMADA: Saltar traits animados (se renderizarán en el GIF)
          const isAnimatedTrait = animatedTraits.some(at => at.baseId === traitId.toString());
          if (isAnimatedTrait) {
            console.log(`[render] PASO 3 - 🎬 Saltando trait animado ${category} (${traitId}) - se renderizará en GIF`);
            continue;
          }
          
          // LÓGICA ESPECIAL: Tokens 30000-35000 usan URL externa
          let traitImage;
          if (traitId >= 30000 && traitId <= 35000) {
            traitImage = await loadExternalTrait(traitId);
            if (traitImage) {
              getDrawContext().drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[render] PASO 3 - 🌐 Trait ${category} (${traitId}) renderizado desde URL externa correctamente`);
            } else {
              console.error(`[render] PASO 3 - 🌐 Error al cargar trait ${category} (${traitId}) desde URL externa`);
            }
          } else if ((traitId >= 100001 && traitId <= 101003) || (traitId >= 101001 && traitId <= 101003)) {
            traitImage = await loadOgpunkTrait(traitId);
            if (traitImage) {
              getDrawContext().drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[render] PASO 3 - 🎯 LÓGICA OGPUNKS: Trait ${category} (${traitId}) renderizado desde ogpunks correctamente`);
            } else {
              console.error(`[render] PASO 3 - 🎯 LÓGICA OGPUNKS: Error al cargar trait ${category} (${traitId}) desde ogpunks`);
            }
          } else {
            traitImage = await loadTraitFromLabimages(traitId);
            if (traitImage) {
              getDrawContext().drawImage(traitImage, 0, 0, 1000, 1000);
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
            getDrawContext().drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 4 - 🌐 TOP trait ${category} (${traitId}) renderizado desde URL externa correctamente`);
          } else {
            console.error(`[render] PASO 4 - 🌐 Error al cargar TOP trait ${category} (${traitId}) desde URL externa`);

        // LÓGICA ESPECIAL: Si el TOP trait es 101003 CAESAR → responder con GIF (con fallback a GitHub)
        if (category === 'TOP' && traitId === 101003) {
          try {
            const gifBuffer = await loadLabimagesAsset('ogpunks/101003.gif');
            if (gifBuffer) {
              res.setHeader('Content-Type', 'image/gif');
              res.setHeader('Cache-Control', 'public, max-age=3600');
              res.send(gifBuffer);
              return;
            }
          } catch (e) {
            console.log(`[render] Fallback a SVG para CAESAR:`, e.message);
          }
        }          }
        } else if ((traitId >= 100001 && traitId <= 101003) || (traitId >= 101001 && traitId <= 101003)) {
          traitImage = await loadOgpunkTrait(traitId);
          if (traitImage) {
            getDrawContext().drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[render] PASO 4 - 🎯 LÓGICA OGPUNKS: TOP trait ${category} (${traitId}) renderizado desde ogpunks correctamente`);
          } else {
            console.error(`[render] PASO 4 - 🎯 LÓGICA OGPUNKS: Error al cargar TOP trait ${category} (${traitId}) desde ogpunks`);
          }
        } else {
          // LÓGICA ESPECIAL: SamuraiZERO traits SOLO si el token tiene tag SamuraiZERO
          let traitImage;
          if (tagInfo && tagInfo.tag === 'SamuraiZERO' && traitId >= 500 && traitId <= 1099) {
            // Es un SamuraiZERO con trait TOP válido, cargar desde samuraizero/ (con fallback a GitHub)
            const assetPath = `samuraizero/${traitId}.svg`;
            console.log(`[render] 🥷 Cargando SamuraiZERO trait desde (con fallback GitHub): ${assetPath}`);
            
            try {
              const svgBuffer = await loadLabimagesAsset(assetPath);
              
              if (!svgBuffer) {
                throw new Error(`Asset no encontrado: ${assetPath}`);
              }
              
              const svgContent = svgBuffer;
              
              // Intentar obtener del caché SVG→PNG primero
              const cachedPng = getCachedSvgPng(svgContent.toString());
              if (cachedPng) {
                traitImage = await loadImage(cachedPng);
              } else {
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
                
                traitImage = await loadImage(pngBuffer);
              }
            } catch (error) {
              console.error(`[render] 🥷 Error al cargar SamuraiZERO trait ${traitId}:`, error.message);
            }
          } else {
            // Trait normal, cargar desde labimages/
            traitImage = await loadTraitFromLabimages(traitId);
          }
          
          if (traitImage) {
            getDrawContext().drawImage(traitImage, 0, 0, 1000, 1000);
            if (tagInfo && tagInfo.tag === 'SamuraiZERO' && traitId >= 500 && traitId <= 1099) {
              console.log(`[render] 🥷 PASO 4 - TOP trait SamuraiZERO ${category} (${traitId}) renderizado desde samuraizero/ correctamente`);
            } else {
              console.log(`[render] PASO 4 - TOP trait ${category} (${traitId}) renderizado desde labimages correctamente`);
            }
          } else {
            console.error(`[render] PASO 4 - Error al cargar TOP trait ${category} (${traitId})`);
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
        getDrawContext().drawImage(specialTraitImage, 0, 0, 1000, 1000);
        console.log(`[render] PASO 4 - 🎯 Token 48 renderizado correctamente en TOP`);
      }
    }

    // ===== PASO SHADOW: generar sombra del contenido (sin background) =====
    // NOTA: Shadow solo se aplica si NO hay glow activo (para evitar conflictos)
    if (isShadow && !isGlow && contentCanvas) {
      try {
        console.log('[render] PASO SHADOW - Generando sombra del contenido');
        const shadowCanvas = createCanvas(canvasWidth, canvasHeight);
        const shadowCtx = shadowCanvas.getContext('2d');
        shadowCtx.drawImage(contentCanvas, 0, 0, canvasWidth, canvasHeight);

        const imgData = shadowCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a !== 0) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = Math.round(a * 0.3);
          }
        }
        shadowCtx.putImageData(imgData, 0, 0);

        // Dibujar sombra desplazada a la izquierda 40px y hacia abajo 15px
        // Solo aplicar sombra a la parte de AdrianZERO (primeros 1000px)
        ctx.drawImage(shadowCanvas, -40, 15, 1000, 1000, 0, 0, 1000, 1000);
        console.log('[render] PASO SHADOW - Sombra aplicada (-40px izquierda, +15px abajo)');

        // Dibujar contenido original encima (solo parte de AdrianZERO)
        ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
        console.log('[render] PASO SHADOW - Contenido original dibujado');
      } catch (e) {
        console.warn('[render] PASO SHADOW - Falló la generación de sombra, continuando sin sombra:', e.message);
        // Fallback: dibujar contenido sin sombra (solo parte de AdrianZERO)
        ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
      }
    }

    // ===== PASO BLACKOUT: generar AdrianZERO completamente negro sobre fondo original =====
    // NOTA: Blackout solo se aplica si NO hay shadow ni glow activo (para evitar conflictos)
    if (isBlackout && !isShadow && !isGlow && contentCanvas) {
      try {
        console.log('[render] PASO BLACKOUT - Generando AdrianZERO completamente negro');
        const blackoutCanvas = createCanvas(canvasWidth, canvasHeight);
        const blackoutCtx = blackoutCanvas.getContext('2d');
        blackoutCtx.drawImage(contentCanvas, 0, 0, canvasWidth, canvasHeight);

        const imgData = blackoutCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a !== 0) {
            // Convertir a negro manteniendo la opacidad original (sin reducir)
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            // Mantener alpha completo (no reducir como en shadow)
            data[i + 3] = a;
          }
        }
        blackoutCtx.putImageData(imgData, 0, 0);

        // Dibujar blackout en la posición original (solo parte de AdrianZERO)
        ctx.drawImage(blackoutCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
        console.log('[render] PASO BLACKOUT - AdrianZERO negro aplicado en posición original');
      } catch (e) {
        console.warn('[render] PASO BLACKOUT - Falló la generación de blackout, continuando sin blackout:', e.message);
        // Fallback: dibujar contenido sin blackout (solo parte de AdrianZERO)
        ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
      }
    } else if (isBlackout && contentCanvas) {
      // Si blackout está activo pero shadow o glow también, dibujar contenido normal (solo parte de AdrianZERO)
      ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
      console.log('[render] PASO BLACKOUT - Blackout deshabilitado por conflicto con shadow/glow');
    }

    // ===== PASO GLOW: generar efecto glow con arcoíris/ripples alrededor =====
    // NOTA: Glow tiene prioridad sobre shadow si ambos están activos
    if (isGlow && contentCanvas) {
      try {
        console.log('[render] PASO GLOW - Generando glow arcoíris alrededor del contenido');
        
        // Crear múltiples capas de glow con gradiente arcoíris
        // Cada capa es más grande que el original pero se dibuja directamente en el canvas de 1000x1000
        // El contenido original mantiene su tamaño (1000x1000)
        const glowLayers = [
          { scale: 1.05, opacity: 0.6 }, // 1050px
          { scale: 1.10, opacity: 0.4 }, // 1100px
          { scale: 1.15, opacity: 0.3 }, // 1150px
          { scale: 1.20, opacity: 0.2 }, // 1200px
          { scale: 1.25, opacity: 0.15 } // 1250px
        ];
        
        // Dibujar cada capa de glow directamente en el canvas principal
        // Las capas se extienden más allá del borde pero el canvas las recorta a 1000x1000
        for (let layerIdx = 0; layerIdx < glowLayers.length; layerIdx++) {
          const layer = glowLayers[layerIdx];
          const layerSize = Math.round(1000 * layer.scale);
          const layerOffset = (1000 - layerSize) / 2; // Negativo para centrar la capa más grande
          
          // Crear canvas temporal para esta capa
          const layerCanvas = createCanvas(layerSize, layerSize);
          const layerCtx = layerCanvas.getContext('2d');
          
          // Copiar contenido original escalado
          layerCtx.drawImage(contentCanvas, 0, 0, layerSize, layerSize);
          
          // Aplicar efecto de glow con colores arcoíris
          const layerImgData = layerCtx.getImageData(0, 0, layerSize, layerSize);
          const layerData = layerImgData.data;
          
          for (let i = 0; i < layerData.length; i += 4) {
            const a = layerData[i + 3];
            if (a !== 0) {
              // Calcular posición para el gradiente arcoíris
              const x = (i / 4) % layerSize;
              const y = Math.floor((i / 4) / layerSize);
              const dx = x - layerSize / 2;
              const dy = y - layerSize / 2;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const maxDist = layerSize / 2;
              const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI); // 0-1
              
              // Generar color arcoíris basado en ángulo y distancia
              const hue = (angle * 360 + distance * 0.1) % 360;
              const saturation = 100;
              const lightness = 50 + (distance / maxDist) * 30;
              
              // Convertir HSL a RGB
              const h = hue / 360;
              const s = saturation / 100;
              const l = lightness / 100;
              
              let r, g, b;
              if (s === 0) {
                r = g = b = l;
              } else {
                const hue2rgb = (p, q, t) => {
                  if (t < 0) t += 1;
                  if (t > 1) t -= 1;
                  if (t < 1/6) return p + (q - p) * 6 * t;
                  if (t < 1/2) return q;
                  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                  return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
              }
              
              layerData[i] = Math.round(r * 255);
              layerData[i + 1] = Math.round(g * 255);
              layerData[i + 2] = Math.round(b * 255);
              layerData[i + 3] = Math.round(a * layer.opacity);
            }
          }
          
          layerCtx.putImageData(layerImgData, 0, 0);
          
          // Dibujar esta capa en el canvas principal (solo en la parte de AdrianZERO cuando hay mensaje)
          // Las partes que se salen se recortan automáticamente
          if (messageText) {
            // Solo dibujar en la parte izquierda (0-1000px)
            ctx.drawImage(layerCanvas, layerOffset, layerOffset, 1000, 1000, 0, 0, 1000, 1000);
          } else {
            ctx.drawImage(layerCanvas, layerOffset, layerOffset);
          }
        }
        
        // Dibujar el contenido original encima del glow (solo parte de AdrianZERO cuando hay mensaje)
        if (messageText) {
          ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
        } else {
          ctx.drawImage(contentCanvas, 0, 0, 1000, 1000);
        }
        
        console.log('[render] PASO GLOW - Glow arcoíris aplicado alrededor del contenido (tamaño original preservado)');
      } catch (e) {
        console.warn('[render] PASO GLOW - Falló la generación de glow, continuando sin glow:', e.message);
        // Fallback: dibujar contenido sin glow (solo parte de AdrianZERO cuando hay mensaje)
        if (messageText) {
          ctx.drawImage(contentCanvas, 0, 0, 1000, 1000, 0, 0, 1000, 1000);
        } else {
          ctx.drawImage(contentCanvas, 0, 0, 1000, 1000);
        }
      }
    }

    // ===== PASO MESSAGES: renderizar texto y bocadillo estilo cómic =====
    if (messageText) {
      try {
        console.log('[render] 💬 PASO MESSAGES - Renderizando mensaje estilo cómic');
        
        // Modo de fuente: por defecto tipo pixel (Press Start 2P),
        // si en la URL viene ?AZ=true (o ?az=true o ?font=AZ) usar AdrianZERO
        const useAdrianFont = req.query.AZ === 'true' || req.query.az === 'true' || req.query.font === 'AZ';

        // Registrar fuentes necesarias
        try {
          const pressStartPath = path.join(process.cwd(), 'public', 'fonts', 'retro', 'PressStart2P-Regular.ttf');
          registerFont(pressStartPath, { family: 'PressStart2P' });
        } catch (e) {
          console.warn('[render] 💬 No se pudo registrar PressStart2P, se usará AdrianZERO como fallback:', e.message);
        }

        const fontFamily = useAdrianFont ? 'AdrianZERO' : 'PressStart2P';
        const fontSize = useAdrianFont ? 182 : 128; // AZ vuelve a su tamaño anterior, PressStart se mantiene grande
        const margin = 10; // margen estándar alrededor del texto
        // Posición del texto: centro-derecha del canvas original (x=800, y=400)
        // Pero como el canvas ahora es 3000px, ajustamos a la parte derecha
        const textX = 1400; // 100 píxeles a la izquierda de 1500
        const textY = 400;  // Misma altura que el centro del AdrianZERO
        
        // Configurar fuente y medir texto
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textMetrics = ctx.measureText(messageText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize * 1.2; // Altura aproximada del texto

        // Altura objetivo del bocadillo (un poco más alta que el texto)
        const bubbleHeight = textHeight + margin * 2;
        const bubbleWidth = textWidth + margin * 2;

        // Coordenadas del bocadillo (centrado alrededor de textX/textY)
        const bubbleX = textX - bubbleWidth / 2;
        const bubbleY = textY - bubbleHeight / 2;

        // Bocadillo estilo pixel-art inspirado en el CSS de referencia:
        // - Rectángulo con “esquinas redondeadas” a base de píxeles (efecto escalera)
        // - Cola más grande en esquina inferior izquierda
        // - Sombra suave debajo/derecha
        const px = 6; // tamaño de pixel base (más grande para un look más marcado)

        // Sombra (similar a .bubble.shadow)
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        // Sombra inferior (dos filas)
        ctx.fillRect(bubbleX + px, bubbleY + bubbleHeight + px, bubbleWidth, px);
        ctx.fillRect(bubbleX + 2 * px, bubbleY + bubbleHeight + 2 * px, bubbleWidth - px, px);
        // Sombra derecha (dos columnas)
        ctx.fillRect(bubbleX + bubbleWidth + px, bubbleY + px, px, bubbleHeight);
        ctx.fillRect(bubbleX + bubbleWidth + 2 * px, bubbleY + 2 * px, px, bubbleHeight - px);

        // Fondo base blanco del bocadillo
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight);

        // Borde negro 8‑bit alrededor con efecto “redondeado” en esquinas:
        ctx.fillStyle = '#000000';
        // Lados rectos principales
        ctx.fillRect(bubbleX, bubbleY - px, bubbleWidth, px);                     // arriba
        ctx.fillRect(bubbleX, bubbleY + bubbleHeight, bubbleWidth, px);           // abajo
        ctx.fillRect(bubbleX - px, bubbleY, px, bubbleHeight);                    // izquierda
        ctx.fillRect(bubbleX + bubbleWidth, bubbleY, px, bubbleHeight);           // derecha

        // Esquinas en escalera (2 niveles) para simular redondeo
        // Arriba-izquierda
        ctx.fillRect(bubbleX - px, bubbleY - px, px, px);
        ctx.fillRect(bubbleX - 2 * px, bubbleY, px, px);
        ctx.fillRect(bubbleX, bubbleY - 2 * px, px, px);
        // Arriba-derecha
        ctx.fillRect(bubbleX + bubbleWidth, bubbleY - px, px, px);
        ctx.fillRect(bubbleX + bubbleWidth + px, bubbleY, px, px);
        ctx.fillRect(bubbleX + bubbleWidth - px, bubbleY - 2 * px, px, px);
        // Abajo-izquierda
        ctx.fillRect(bubbleX - px, bubbleY + bubbleHeight, px, px);
        ctx.fillRect(bubbleX - 2 * px, bubbleY + bubbleHeight - px, px, px);
        ctx.fillRect(bubbleX, bubbleY + bubbleHeight + px, px, px);
        // Abajo-derecha
        ctx.fillRect(bubbleX + bubbleWidth, bubbleY + bubbleHeight, px, px);
        ctx.fillRect(bubbleX + bubbleWidth + px, bubbleY + bubbleHeight - px, px, px);
        ctx.fillRect(bubbleX + bubbleWidth - px, bubbleY + bubbleHeight + px, px, px);

        // Cola del bocadillo en esquina inferior izquierda (más grande y cohesiva)
        const tailBaseX = bubbleX + 3 * px;
        const tailBaseY = bubbleY + bubbleHeight;

        // Parte negra exterior de la cola (escalera más grande y ancha)
        ctx.fillRect(tailBaseX,           tailBaseY + px,     2 * px, px);
        ctx.fillRect(tailBaseX - px,      tailBaseY + 2 * px, 2 * px, px);
        ctx.fillRect(tailBaseX - 2 * px,  tailBaseY + 3 * px, 2 * px, px);
        ctx.fillRect(tailBaseX - 3 * px,  tailBaseY + 4 * px, 2 * px, px);
        ctx.fillRect(tailBaseX - 4 * px,  tailBaseY + 5 * px, 2 * px, px);

        // Relleno blanco interior para integrarlo con el bocadillo
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tailBaseX,           tailBaseY,          2 * px, px);
        ctx.fillRect(tailBaseX - px,      tailBaseY + px,     2 * px, px);
        ctx.fillRect(tailBaseX - 2 * px,  tailBaseY + 2 * px, 2 * px, px);
        ctx.fillRect(tailBaseX - 3 * px,  tailBaseY + 3 * px, 2 * px, px);

        console.log(`[render] 💬 Bocadillo renderizado (canvas) con cola grande y bordes escalonados: x=${bubbleX}, y=${bubbleY}, w=${bubbleWidth}, h=${bubbleHeight}`);
        
        // Dibujar texto en negro encima del bocadillo
        ctx.fillStyle = '#000000';
        ctx.fillText(messageText, textX, textY);
        console.log(`[render] 💬 Texto renderizado: "${messageText}" en x=${textX}, y=${textY}`);
        
      } catch (e) {
        console.warn('[render] 💬 PASO MESSAGES - Falló el renderizado del mensaje, continuando sin mensaje:', e.message);
      }
    }

    // ===== LÓGICA CLOSEUP PARA TOKEN 202 =====
    let finalBuffer;
    let finalCanvas = canvas;
    let finalCtx = ctx;
    
    if (isCloseup) {
      console.log(`[render] 🔍 Aplicando closeup 640x640 para token ${cleanTokenId}`);
      
      // Crear nuevo canvas 640x640 para closeup
      const closeupCanvas = createCanvas(640, 640);
      const closeupCtx = closeupCanvas.getContext('2d');
      
      // Recortar y escalar correctamente:
      // 1. La imagen original es 1000x1000 (cuadrada)
      // 2. Para closeup 640x640 (cuadrada), recortar área cuadrada de 640x640
      // 3. Posición del recorte: x=150 (derecha), y=50 (abajo)
      // 4. Escalar directamente a 640x640 (factor 1:1)
      
      const cropX = 200;  // Desplazamiento a la derecha
      const cropY = 85;   // Desplazamiento hacia abajo
      const cropSize = 640; // Tamaño del recorte
      
      closeupCtx.drawImage(
        canvas, 
        cropX, cropY, cropSize, cropSize,  // Fuente: x=200, y=50, w=640, h=640
        0, 0, 640, 640                     // Destino: x=0, y=0, w=640, h=640
      );
      
      finalCanvas = closeupCanvas;
      finalCtx = closeupCtx;
      finalBuffer = closeupCanvas.toBuffer('image/png');
      
      console.log(`[render] 🔍 Closeup 640x640 generado para token ${cleanTokenId}`);
    } else {
      finalBuffer = canvas.toBuffer('image/png');
    }

    // ===== PASO BN: convertir a escala de grises (DEBE SER DESPUÉS DE TODOS LOS EFECTOS) =====
    if (isBn) {
      try {
        console.log('[render] PASO BN - Convirtiendo imagen a blanco y negro');
        
        // Obtener el canvas final (puede ser closeupCanvas o canvas normal)
        const sourceCanvas = finalCanvas || canvas;
        const sourceCtx = sourceCanvas.getContext('2d');
        
        // Obtener los datos de imagen del canvas
        const imgData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const data = imgData.data;
        
        // Convertir cada píxel a escala de grises
        for (let i = 0; i < data.length; i += 4) {
          // Preservar transparencia (alpha channel)
          const alpha = data[i + 3];
          if (alpha !== 0) {
            // Calcular luminancia (fórmula estándar para conversión RGB a gris)
            // Usamos pesos estándar: 0.299*R + 0.587*G + 0.114*B
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            
            // Aplicar el valor de gris a todos los canales RGB
            data[i] = gray;     // Red
            data[i + 1] = gray; // Green
            data[i + 2] = gray; // Blue
            // Alpha se mantiene igual (data[i + 3])
          }
        }
        
        // Aplicar los cambios al canvas
        sourceCtx.putImageData(imgData, 0, 0);
        
        // Regenerar el buffer final si es necesario
        if (finalCanvas) {
          finalBuffer = finalCanvas.toBuffer('image/png');
        }
        
        console.log('[render] PASO BN - Conversión a blanco y negro completada');
      } catch (e) {
        console.warn('[render] PASO BN - Falló la conversión a BN, continuando sin BN:', e.message);
      }
    }

    // ===== PASO UV: aplicar efecto UV/Blacklight (DEBE SER DESPUÉS DE TODOS LOS EFECTOS) =====
    if (isUv) {
      try {
        console.log('[render] PASO UV - Aplicando efecto UV/Blacklight');
        
        // Obtener el canvas final (puede ser closeupCanvas o canvas normal)
        const sourceCanvas = finalCanvas || canvas;
        const sourceCtx = sourceCanvas.getContext('2d');
        
        // Función de interpolación de colores Blacklight
        function interpolateColor(value) {
          const colors = [
            [255, 0, 255],   // Magenta
            [0, 255, 255],   // Cyan
            [0, 250, 154],   // Medium Spring Green
            [173, 255, 47],  // Green Yellow
            [0, 0, 0]        // Black
          ];
          const steps = colors.length - 1;
          const step = 255 / steps;
          let index = Math.floor(value / step);
          if (index >= steps) index = steps - 1;
          const t = (value - step * index) / step;
          const [r1, g1, b1] = colors[index];
          const [r2, g2, b2] = colors[index + 1];
          return [
            Math.round(r1 + (r2 - r1) * t),
            Math.round(g1 + (g2 - g1) * t),
            Math.round(b1 + (b2 - b1) * t)
          ];
        }
        
        // Crear canvas para el efecto UV
        const uvCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
        const uvCtx = uvCanvas.getContext('2d');
        
        // Obtener datos de la imagen original
        const imgData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const data = imgData.data;
        
        // Crear datos para el efecto UV
        const uvData = uvCtx.createImageData(sourceCanvas.width, sourceCanvas.height);
        
        // Aplicar interpolación de colores basada en luminosidad
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha !== 0) {
            // Calcular escala de grises (luminosidad)
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            let [r, g, b] = interpolateColor(gray);
            
            // Boost de brillo y saturación para efecto neon más intenso
            // Aumentar brillo directamente (1.4x) para colores más luminosos
            r = Math.min(255, Math.round(r * 1.4));
            g = Math.min(255, Math.round(g * 1.4));
            b = Math.min(255, Math.round(b * 1.4));
            
            // Aumentar saturación: empujar colores hacia los extremos
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max > 0) {
              // Aumentar la diferencia entre max y min para más saturación
              const avg = (r + g + b) / 3;
              const factor = 1.3; // Factor de saturación neon
              r = Math.min(255, Math.max(0, Math.round(avg + (r - avg) * factor)));
              g = Math.min(255, Math.max(0, Math.round(avg + (g - avg) * factor)));
              b = Math.min(255, Math.max(0, Math.round(avg + (b - avg) * factor)));
            }
            
            uvData.data[i] = r;
            uvData.data[i + 1] = g;
            uvData.data[i + 2] = b;
            uvData.data[i + 3] = 220; // Alpha aumentado para overlay más visible (neon)
          } else {
            uvData.data[i] = 0;
            uvData.data[i + 1] = 0;
            uvData.data[i + 2] = 0;
            uvData.data[i + 3] = 0;
          }
        }
        
        uvCtx.putImageData(uvData, 0, 0);
        
        // Aplicar blur suave al efecto UV (2px - más suave que antes)
        // Nota: canvas no soporta filter directamente, así que aplicamos un blur manual simple
        const blurCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
        const blurCtx = blurCanvas.getContext('2d');
        blurCtx.drawImage(uvCanvas, 0, 0);
        
        // Obtener los datos del canvas después de dibujar (no del ImageData original)
        const canvasData = blurCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const canvasDataArray = canvasData.data;
        
        // Aplicar blur simple (promedio de píxeles vecinos) - blurRadius = 2 para blur suave
        const blurData = blurCtx.createImageData(sourceCanvas.width, sourceCanvas.height);
        const blurRadius = 2;
        for (let y = blurRadius; y < sourceCanvas.height - blurRadius; y++) {
          for (let x = blurRadius; x < sourceCanvas.width - blurRadius; x++) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            for (let dy = -blurRadius; dy <= blurRadius; dy++) {
              for (let dx = -blurRadius; dx <= blurRadius; dx++) {
                const idx = ((y + dy) * sourceCanvas.width + (x + dx)) * 4;
                r += canvasDataArray[idx];
                g += canvasDataArray[idx + 1];
                b += canvasDataArray[idx + 2];
                a += canvasDataArray[idx + 3];
                count++;
              }
            }
            const idx = (y * sourceCanvas.width + x) * 4;
            blurData.data[idx] = Math.round(r / count);
            blurData.data[idx + 1] = Math.round(g / count);
            blurData.data[idx + 2] = Math.round(b / count);
            blurData.data[idx + 3] = Math.round(a / count);
          }
        }
        blurCtx.putImageData(blurData, 0, 0);
        
        // Boost de contraste y brillo para efecto neon más intenso (1.4x)
        const boostedData = blurCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        const boosted = boostedData.data;
        for (let i = 0; i < boosted.length; i += 4) {
          // Boost contrast y brillo para efecto neon (solo RGB, no alpha)
          const alpha = boosted[i + 3];
          if (alpha > 0) {
            // Aumentar contraste y brillo más agresivamente para efecto neon
            boosted[i] = Math.min(255, Math.round(boosted[i] * 1.4));     // R
            boosted[i + 1] = Math.min(255, Math.round(boosted[i + 1] * 1.4)); // G
            boosted[i + 2] = Math.min(255, Math.round(boosted[i + 2] * 1.4)); // B
            // Aumentar alpha también para efecto más visible
            boosted[i + 3] = Math.min(255, Math.round(alpha * 1.1));
          }
        }
        blurCtx.putImageData(boostedData, 0, 0);
        
        // Superponer el efecto UV sobre la imagen original con globalAlpha más fuerte para efecto neon
        sourceCtx.globalAlpha = 1.0; // Overlay completo para efecto neon más intenso
        sourceCtx.drawImage(blurCanvas, 0, 0);
        sourceCtx.globalAlpha = 1.0; // Restaurar alpha
        
        // Regenerar el buffer final
        if (finalCanvas) {
          finalBuffer = finalCanvas.toBuffer('image/png');
        } else {
          finalBuffer = canvas.toBuffer('image/png');
        }
        
        console.log('[render] PASO UV - Efecto UV/Blacklight aplicado');
      } catch (e) {
        console.warn('[render] PASO UV - Falló la aplicación de UV, continuando sin UV:', e.message);
      }
    }

    // Si no se generó finalBuffer aún, generarlo ahora
    if (!finalBuffer) {
      finalBuffer = (finalCanvas || canvas).toBuffer('image/png');
    }

    // ===== GENERAR GIF SI HAY TRAITS ANIMADOS =====
    if (hasAnimatedTraits && animatedTraits.length > 0) {
      try {
        console.log('[render] 🎬 Generando GIF con traits animados...');
        
        // El finalBuffer contiene el PNG base sin los traits animados
        // Generar GIF añadiendo los traits animados frame por frame
        let gifConfig = {
          stableLayers: [
            { pngBuffer: finalBuffer } // PNG base sin traits animados
          ],
          animatedTraits: animatedTraits,
          width: 1000,
          height: 1000,
          delay: 500
        };
        
        // Aplicar bounce si está configurado
        if (bounceConfig && bounceConfig.enabled) {
          const { createBounceFrameGenerator } = await import('../../../lib/gif-generator.js');
          gifConfig.customFrameGenerator = createBounceFrameGenerator({
            stableLayers: gifConfig.stableLayers,
            animatedTraits: gifConfig.animatedTraits,
            bounceConfig: bounceConfig,
            width: gifConfig.width,
            height: gifConfig.height,
            delay: gifConfig.delay
          });
          // Limpiar stableLayers y animatedTraits ya que se manejan en customFrameGenerator
          gifConfig.stableLayers = [];
          gifConfig.animatedTraits = [];
        }
        
        const gifBuffer = await generateGifFromLayers(gifConfig);
        
        // Guardar en caché (usando equippedTraits final después de todas las modificaciones)
        setCachedAdrianZeroGif(cleanTokenId, gifBuffer, equippedTraits, bounceConfig);
        
        const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
        console.log(`[render] 🎬 GIF generado y cacheado por ${ttlSeconds}s`);
        
        // Configurar headers para GIF
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
        const gifVersionParts = ['ADRIANZERO-ANIMATED'];
        if (isBounce) {
          gifVersionParts.push('BOUNCE');
          res.setHeader('X-Bounce', 'enabled');
        }
        res.setHeader('X-Version', gifVersionParts.join('-'));
        res.setHeader('Content-Length', gifBuffer.length);
        
        return res.status(200).send(gifBuffer);
      } catch (error) {
        console.error('[render] 🎬 Error generando GIF, continuando con PNG:', error.message);
        console.error('[render] 🎬 Stack:', error.stack);
        // Continuar con PNG si falla la generación de GIF
      }
    }

    // ===== PASO BANANA: aplicar transformación Nano Banana (DEBE SER DESPUÉS DE TODOS LOS EFECTOS) =====
    // NOTA: Si hay messageText, NO aplicar banana - usar renderizado normal por capas
    // Banana y messages son lógicas completamente separadas
    if (isBanana && !messageText) {
      try {
        console.log('[render] PASO BANANA - Aplicando transformación Nano Banana');
        
        // Obtener información de traits para el prompt personalizado
        let customPrompt = null;
        try {
          // traitIds y categories ya están disponibles desde getAllEquippedTraits
          if (traitIds && traitIds.length > 0) {
            console.log('[render] PASO BANANA - Obteniendo información de traits para prompt personalizado');
            
            // Cargar metadata de traits
            const traitsArray = loadMetadataForToken(cleanTokenId);
            
            // Obtener información de traits
            const traitsInfo = getTraitsInfo(traitIds, traitsArray);
            
            if (traitsInfo.length > 0) {
              console.log(`[render] PASO BANANA - Encontrados ${traitsInfo.length} traits para incluir en prompt`);
              // Construir prompt personalizado con información de traits
              customPrompt = buildNanobananaPrompt(traitsInfo);
              console.log('[render] PASO BANANA - Prompt personalizado construido con información de traits');
            } else {
              console.log('[render] PASO BANANA - No se encontraron traits, usando prompt base');
            }
          }
        } catch (error) {
          console.warn('[render] PASO BANANA - Error obteniendo información de traits, usando prompt base:', error.message);
          // Continuar con prompt base si hay error
        }
        
        // Transformar la imagen con Nano Banana (con prompt personalizado si está disponible)
        const transformedBuffer = await transformWithNanoBanana(finalBuffer, customPrompt);
        
        // Usar el buffer transformado como final
        finalBuffer = transformedBuffer;
        
        console.log('[render] PASO BANANA - Transformación Nano Banana aplicada');
      } catch (e) {
        console.warn('[render] PASO BANANA - Falló la transformación Nano Banana, continuando sin banana:', e.message);
        // Continuar con el buffer original si falla la transformación
      }
    } else if (isBanana && messageText) {
      console.log('[render] PASO BANANA - Banana detectado pero messageText presente, omitiendo transformación Nano Banana');
    }

    // ===== GUARDAR EN CACHÉ Y RETORNAR =====
    // Guardar en caché incluyendo información de efectos para diferenciación (DESPUÉS de todos los efectos)
    if (isCloseup) {
      setCachedAdrianZeroCloseup(cleanTokenId, finalBuffer, isShadow, isGlow, isBn, isUv, isBlackout, isBanana);
    } else {
      setCachedAdrianZeroRender(cleanTokenId, finalBuffer, isShadow, isGlow, isBn, isUv, isBlackout, isBanana, messageText);
    }

    const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
    console.log(`[render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${cleanTokenId}`);

    // ===== SUBIR A GITHUB SI TIENE TOGGLE 13 (BANANA) ACTIVO =====
    // ESTRATEGIA HÍBRIDA: Solo subir con hash si NO existe archivo con nombre fijo (compatibilidad)
    // Subir el archivo a GitHub después del renderizado (antes de enviar la respuesta)
    // Solo subir si tiene toggle 13 (banana) activo Y NO hay messageText
    // Si hay messageText, no subir como banana para no sobrescribir el archivo original
    // Esperamos la subida para garantizar que se complete antes de que Vercel termine el proceso
    if (isBanana && !messageText) {
      const renderType = 'banana';
      
      // Verificar si existe archivo con nombre fijo (compatibilidad hacia atrás)
      const existsInGitHubFixedName = await fileExistsInGitHub(cleanTokenId, renderType);
      
      if (existsInGitHubFixedName) {
        console.log(`[render] 📦 Archivo con nombre fijo ya existe en GitHub para token ${cleanTokenId} (${renderType}) - No se subirá (manteniendo compatibilidad)`);
      } else {
        // No existe archivo con nombre fijo, subir con hash (nuevo sistema)
        console.log(`[render] 🚀 Iniciando subida a GitHub con hash para token ${cleanTokenId} (hash: ${renderHash})`);
        try {
          const uploadSuccess = await uploadFileToGitHubByHash(cleanTokenId, finalBuffer, renderHash);
          if (uploadSuccess) {
            console.log(`[render] ✅ Archivo subido exitosamente a GitHub con hash para token ${cleanTokenId} (hash: ${renderHash})`);
          } else {
            console.error(`[render] ❌ Error subiendo archivo a GitHub con hash para token ${cleanTokenId} (hash: ${renderHash})`);
          }
        } catch (error) {
          console.error(`[render] ❌ Error subiendo archivo a GitHub con hash:`, error.message);
          console.error(`[render] ❌ Stack:`, error.stack);
          // Continuar con el renderizado aunque falle la subida a GitHub
        }
      }
    }
    
    // ===== SUBIR A GITHUB CON HASH PARA RENDERS NORMALES =====
    // Subir el archivo a GitHub usando hash único (solo si no es banana, que tiene su propia lógica)
    // Esto permite verificar si un render con las mismas características ya existe
    if (!isBanana) {
      console.log(`[render] 🚀 Iniciando subida a GitHub con hash para token ${cleanTokenId} (hash: ${renderHash})`);
      try {
        const uploadSuccess = await uploadFileToGitHubByHash(cleanTokenId, finalBuffer, renderHash);
        if (uploadSuccess) {
          console.log(`[render] ✅ Archivo subido exitosamente a GitHub para token ${cleanTokenId} (hash: ${renderHash})`);
        } else {
          console.error(`[render] ❌ Error subiendo archivo a GitHub para token ${cleanTokenId} (hash: ${renderHash})`);
        }
      } catch (error) {
        console.error(`[render] ❌ Error subiendo archivo a GitHub por hash:`, error.message);
        console.error(`[render] ❌ Stack:`, error.stack);
        // Continuar con el renderizado aunque falle la subida a GitHub
      }
    }

    // Configurar headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Render-Hash', renderHash);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
    
    const versionParts = [];
    if (isCloseup) versionParts.push('CLOSEUP');
    if (isShadow) versionParts.push('SHADOW');
    if (isGlow) versionParts.push('GLOW');
    if (isBn) versionParts.push('BN');
    if (isUv) versionParts.push('UV');
    if (isBlackout) versionParts.push('BLACKOUT');
    if (isBanana) versionParts.push('BANANA');
    if (isBounce) versionParts.push('BOUNCE');
    const versionSuffix = versionParts.length > 0 ? `-${versionParts.join('-')}` : '';
    
    if (isCloseup) {
      res.setHeader('X-Version', `ADRIANZERO-CLOSEUP${versionSuffix}`);
      res.setHeader('X-Render-Type', 'closeup');
    } else {
      res.setHeader('X-Version', `ADRIANZERO-FULL${versionSuffix}`);
      res.setHeader('X-Render-Type', 'full');
    }
    
    if (isShadow) {
      res.setHeader('X-Shadow', 'enabled');
    }
    
    if (isGlow) {
      res.setHeader('X-Glow', 'enabled');
    }
    
    if (isBn) {
      res.setHeader('X-BN', 'enabled');
    }
    
    if (isUv) {
      res.setHeader('X-UV', 'enabled');
    }
    
    if (isBlackout) {
      res.setHeader('X-Blackout', 'enabled');
    }
    
    if (isBanana) {
      res.setHeader('X-Banana', 'enabled');
    }
    
    if (isBounce) {
      res.setHeader('X-Bounce', 'enabled');
    }
    
    // ===== APLICAR BOUNCE A PNG SI ESTÁ CONFIGURADO =====
    if (bounceConfig && bounceConfig.enabled && !hasAnimatedTraits) {
      try {
        const { calculateBounceWithDelay } = await import('../../../lib/animation-helpers.js');
        // Para PNG estático, usar frame 0 del ciclo de bounce
        const bounceTransform = calculateBounceWithDelay(
          0,
          bounceConfig.frames,
          bounceConfig.direction,
          bounceConfig.distance,
          bounceConfig.bounces,
          0
        );
        
        // Aplicar transformación de bounce al PNG
        const canvas = createCanvas(1000, 1000);
        const ctx = canvas.getContext('2d');
        const img = await loadImage(finalBuffer);
        
        ctx.save();
        ctx.translate(1000 / 2 + bounceTransform.x, 1000 / 2 + bounceTransform.y);
        if (bounceTransform.rotation !== 0) {
          ctx.rotate(bounceTransform.rotation * Math.PI / 180);
        }
        if (bounceTransform.scale !== 1) {
          ctx.scale(bounceTransform.scale, bounceTransform.scale);
        }
        ctx.drawImage(img, -1000 / 2, -1000 / 2, 1000, 1000);
        ctx.restore();
        
        finalBuffer = canvas.toBuffer('image/png');
        console.log('[render] ⚡ Bounce aplicado a PNG estático');
      } catch (error) {
        console.warn('[render] ⚡ Error aplicando bounce a PNG, continuando sin bounce:', error.message);
      }
    }
    
    res.setHeader('Content-Length', finalBuffer.length);
    res.send(finalBuffer);

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
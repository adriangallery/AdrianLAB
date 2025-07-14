// API endpoint for rendering tokens by tokenId
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../lib/contracts.js';

// Cache para traits animados
const animatedTraitsCache = new Map();

// Función para detectar si un SVG es animado
const detectSvgAnimation = (svgContent) => {
  const animationPatterns = [
    '<animate', '<animateTransform', '<animateMotion',
    '@keyframes', 'animation:', 'transition:', 'dur=', 'repeatCount='
  ];
  
  return animationPatterns.some(pattern => svgContent.includes(pattern));
};

// Función para cargar SVG y detectar animación
const loadAndDetectAnimation = async (path) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/traits/${path}`;
    
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const svgContent = await response.text();
    const isAnimated = detectSvgAnimation(svgContent);
    
    return {
      content: svgContent,
      isAnimated: isAnimated
    };
  } catch (error) {
    console.error(`Error cargando SVG ${path}:`, error.message);
    return { content: null, isAnimated: false };
  }
};

// Función principal de detección híbrida
const isTraitAnimated = async (traitData, traitPath) => {
  // Prioridad 1: Metadata en traits.json
  if (traitData && traitData.animated !== undefined) {
    return traitData.animated;
  }
  
  // Prioridad 2: Cache
  if (animatedTraitsCache.has(traitPath)) {
    return animatedTraitsCache.get(traitPath);
  }
  
  // Prioridad 3: Detección dinámica
  try {
    const svgData = await loadAndDetectAnimation(traitPath);
    animatedTraitsCache.set(traitPath, svgData.isAnimated);
    return svgData.isAnimated;
  } catch (error) {
    console.warn(`No se pudo detectar animación para ${traitPath}:`, error);
    return false;
  }
};

// Función para generar GIF animado (placeholder)
const generateAnimatedGif = async (equippedTraits, baseImagePath, skinTraitPath) => {
  // Por ahora, generamos un PNG con indicador de animación
  // En el futuro, aquí iría la lógica de generación de GIF
  console.log('[render] Generando GIF animado para traits animados');
  
  // Crear canvas con fondo blanco
  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1000, 1000);
  
  // Añadir indicador de animación
  ctx.fillStyle = '#ff0000';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ANIMATED TRAIT DETECTED', 500, 500);
  ctx.fillText('GIF generation coming soon', 500, 550);
  
  return canvas.toBuffer('image/png');
};

// Función para normalizar categorías a mayúsculas
const normalizeCategory = (category) => {
  // Todas las categorías ya están en mayúsculas en traits.json
  // Solo mantener el mapeo PACKS->SWAG para compatibilidad con el contrato
  const categoryMap = {
    'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
  };
  
  return categoryMap[category] || category;
};

// LÓGICA ESPECIAL: Mapear ciertos tokens de HEAD a HAIR
const HEAD_TO_HAIR_TOKENS = [
  14, 17, 18, 19, 20, 21, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 190, 198, 199, 203, 204, 207, 218, 219, 226, 236
];

// Función para verificar si un token debe renderizarse como HAIR
const shouldRenderAsHair = (traitId) => {
  return HEAD_TO_HAIR_TOKENS.includes(parseInt(traitId));
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

    // Función para cargar y renderizar SVG
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
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
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
          } else {
            // Para otros skins: GF{gen}-{skinType}.svg
            skinFileName = `GF${generation}-${skinType}.svg`;
          }
          
          const adrianGfPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', `GF${generation}`, skinFileName);
          console.log(`[render] Cargando ADRIANGF desde sistema de archivos: ${adrianGfPath}`);
          
          const svgContent = fs.readFileSync(adrianGfPath, 'utf8');
          
          // Renderizar SVG a PNG
          const resvg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            }
          });
          
          const pngBuffer = resvg.render().asPng();
          return loadImage(pngBuffer);
        } else {
          // Lógica original para otros serums
          const serumNameUpper = serumName.toUpperCase();
          const adrianPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `${serumNameUpper}.svg`);
          console.log(`[render] Cargando Adrian desde sistema de archivos: ${adrianPath}`);
          
          const svgContent = fs.readFileSync(adrianPath, 'utf8');
          
          // Renderizar SVG a PNG
          const resvg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            }
          });
          
          const pngBuffer = resvg.render().asPng();
          return loadImage(pngBuffer);
        }
      } catch (error) {
        console.error(`[render] Error cargando Adrian SVG ${serumName}:`, error.message);
        return null;
      }
    };

    // Determinar la imagen base según generación y skin
    const gen = generation.toString();
    let baseImagePath;

    // Mapear skin para determinar la imagen a mostrar
    let skinType;
    
    console.log('[render] Analizando skin:', {
      skinId,
      skinName,
      generacion: gen
    });
    
    if (skinName === "Zero" || skinId === "0" || skinId === "1") {
      skinType = "Medium";
      console.log('[render] Skin Zero detectado, usando Medium');
    } else if (skinId === "2" || skinName === "Dark") {
      skinType = "Dark";
    } else if (skinId === "3" || skinName === "Alien") {
      skinType = "Alien";
    } else {
      skinType = skinName || "Medium";
    }

    // Construir path del Adrian base
    baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
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
    let appliedSerum = null;
    let serumFailed = false;
    try {
      console.log('[render] Verificando si hay serum aplicado...');
      const serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        const lastSerum = serumHistory[serumHistory.length - 1];
        const serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        console.log(`[render] Historial de serum encontrado:`, {
          success: serumSuccess,
          mutation: serumMutation,
          hasBeenModified: hasBeenModified
        });
        
        // LÓGICA CORREGIDA según el contrato SerumModule (consistente con metadata):
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
          console.log(`[render] Serum fallido detectado: success = false (será "FAILED" en metadata)`);
        }
      }
    } catch (error) {
      console.log('[render] Error verificando serum aplicado:', error.message);
    }

    // DETECCIÓN DE ANIMACIONES
    console.log('[render] Iniciando detección de animaciones...');
    
    // Cargar datos de traits.json para verificar metadata
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    let labmetadata;
    try {
      const labmetadataBuffer = fs.readFileSync(labmetadataPath);
      labmetadata = JSON.parse(labmetadataBuffer.toString());
    } catch (error) {
      console.warn('[render] No se pudo cargar traits.json para detección de animaciones');
      labmetadata = { traits: [] };
    }

    // Detectar si hay traits animados
    const hasAnyAnimation = await Promise.all(
      Object.entries(equippedTraits).map(async ([category, traitId]) => {
        const traitPath = `${category}/${traitId}.svg`; // category ya está normalizada
        const traitData = labmetadata.traits.find(t => t.tokenId === parseInt(traitId));
        const isAnimated = await isTraitAnimated(traitData, traitPath);
        
        if (isAnimated) {
          console.log(`[render] Trait animado detectado: ${category}/${traitId}`);
        }
        
        return isAnimated;
      })
    ).then(results => results.some(Boolean));

    console.log(`[render] Animaciones detectadas: ${hasAnyAnimation}`);

    // Si hay animaciones, generar GIF (por ahora PNG con indicador)
    if (hasAnyAnimation) {
      console.log('[render] Generando formato animado...');
      const animatedBuffer = await generateAnimatedGif(equippedTraits, baseImagePath, skinTraitPath);
      
      // Configurar headers para evitar cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Enviar imagen animada
      res.setHeader('Content-Type', 'image/png'); // Por ahora PNG, en el futuro GIF
      res.setHeader('Content-Length', animatedBuffer.length);
      res.send(animatedBuffer);
      
      console.log('[render] Renderizado animado completado exitosamente');
      return;
    }

    // Si no hay animaciones, continuar con renderizado PNG normal
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
      
      // LÓGICA ESPECIAL PARA ADRIANGF: Manejar éxito y fallo
      if (appliedSerum === "AdrianGF") {
        // Serum exitoso: usar skin específico según GEN y tipo
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
    // LÓGICA ESPECIAL: Si hay serum fallido, usar GF-Fail
    else if (serumFailed) {
      console.log(`[render] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum fallido detectado, usando GF-Fail`);
      const failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
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
        console.log('[render] PASO 2 - 🧬 Skin ADRIANGF fallido (GF-Fail) renderizado correctamente');
      } catch (error) {
        console.error(`[render] PASO 2 - Error al cargar GF-Fail, usando skin base normal:`, error.message);
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
      // Usar skin base normal
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
    // Nuevo orden de renderizado: incluyendo HAIR antes que HEAD
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'HAIR', 'HEAD', 'SWAG', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS', 'RANDOMSHIT'];

    for (const category of traitOrder) {
      if (equippedTraits[category]) {
        const traitPath = `${category}/${equippedTraits[category]}.svg`;
        console.log(`[render] PASO 3 - Cargando trait: ${traitPath}`);

        // LÓGICA ESPECIAL: Token 48 (S.W.A.T-Shild) se renderiza en TOP
        if (category === 'GEAR' && equippedTraits[category] === '48') {
          console.log(`[render] PASO 3 - ⚠️  LÓGICA ESPECIAL: Token 48 detectado, se renderizará en TOP`);
          continue; // Saltar este trait aquí, se renderizará en TOP
        }

        // LÓGICA ESPECIAL: Token 84 (Bunny-Suit) - no renderizar HEAD cuando está presente
        if (category === 'HEAD' && equippedTraits['SWAG'] === '84') {
          console.log(`[render] PASO 3 - ⚠️  LÓGICA ESPECIAL: Token 84 detectado, omitiendo HEAD`);
          continue; // Saltar HEAD cuando token 84 está presente
        }



        // LÓGICA ESPECIAL: Omitir skin traits especiales en SWAG (ya se renderizaron en paso 2.5)
        if (category === 'SWAG' && (equippedTraits[category] === '37' || equippedTraits[category] === '38')) {
          console.log(`[render] PASO 3 - ⚠️  LÓGICA ESPECIAL: Skin trait especial ya renderizado en paso 2.5, omitiendo`);
          continue;
        }

        // LÓGICA ESPECIAL: Token 8 (3D Laser Eyes) se comporta como EYES aunque esté en SERUMS
        // LÓGICA ESPECIAL: Token 7 (3D Glasses) se comporta como EYES aunque esté en SERUMS
        let actualTraitPath = traitPath;
        if (category === 'SERUMS' && equippedTraits[category] === '8') {
          console.log(`[render] PASO 3 - ⚠️  LÓGICA ESPECIAL: Token 8 detectado, se comportará como EYES`);
          actualTraitPath = `EYES/8.svg`;
        } else if (category === 'SERUMS' && equippedTraits[category] === '7') {
          console.log(`[render] PASO 3 - ⚠️  LÓGICA ESPECIAL: Token 7 detectado, se comportará como EYES`);
          actualTraitPath = `EYES/7.svg`;
        }

        const traitImage = await loadAndRenderSvg(actualTraitPath);
        if (traitImage) {
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
          console.log(`[render] PASO 3 - Trait ${category} renderizado correctamente`);
        }
      }
    }

    // 4. CUARTO: Renderizar TOP layers (van encima de todas las demás)
    console.log('[render] PASO 4 - Iniciando renderizado de TOP layers');
    const topOrder = ['TOP'];

    for (const category of topOrder) {
      if (equippedTraits[category]) {
        const traitPath = `${category}/${equippedTraits[category]}.svg`;
        console.log(`[render] PASO 4 - Cargando TOP trait: ${traitPath}`);

        const traitImage = await loadAndRenderSvg(traitPath);
        if (traitImage) {
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
          console.log(`[render] PASO 4 - TOP trait ${category} renderizado correctamente`);
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
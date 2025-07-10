// API endpoint for rendering custom tokens with modified traits
import { createCanvas, loadImage } from 'canvas';
import { getContracts } from '../../../../lib/contracts.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

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
const generateAnimatedGif = async (finalTraits, baseImagePath, skinTraitPath) => {
  // Por ahora, generamos un PNG con indicador de animación
  // En el futuro, aquí iría la lógica de generación de GIF
  console.log('[custom-render] Generando GIF animado para traits animados');
  
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
  const categoryMap = {
    'Head': 'HEAD',
    'Swag': 'SWAG',
    'PACKS': 'SWAG',  // Mapear PACKS a SWAG
    'Background': 'BACKGROUND',
    'Ear': 'EAR',
    'Eyes': 'EYES',
    'Mouth': 'MOUTH',
    'Neck': 'NECK',
    'Nose': 'NOSE',
    'Skin': 'SKIN',
    'Gear': 'GEAR',
    'Beard': 'BEARD',
    'Randomshit': 'RANDOMSHIT'
  };
  
  return categoryMap[category] || category.toUpperCase();
};

// =============================================
// SECCIÓN DE MAPEO DE TRAITS
// =============================================

// Función para cargar el mapeo de traits desde el JSON
const loadTraitsMapping = () => {
  try {
    const traitsPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    const traitsData = JSON.parse(fs.readFileSync(traitsPath, 'utf8'));
    
    const mapping = {};
    traitsData.traits.forEach(trait => {
      mapping[trait.tokenId] = {
        category: trait.category.toUpperCase(),
        name: trait.name,
        fileName: trait.fileName
      };
    });
    
    return mapping;
  } catch (error) {
    console.error('[custom-render] Error cargando mapeo de traits:', error);
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
    console.log(`[custom-render] Iniciando renderizado personalizado para token ${cleanTokenId}`);

    // Verify that tokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[custom-render] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Cargar mapeo de traits
    const traitsMapping = loadTraitsMapping();
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
            fileName: traitInfo.fileName
          });
          
          console.log(`[custom-render] Trait ID ${traitId} (${traitInfo.name}) mapeado a categoría ${category}`);
        } else {
          console.warn(`[custom-render] Trait ID ${traitId} no encontrado en el mapeo`);
        }
      });
      
      // Resolver conflictos: usar solo el último trait de cada categoría
      Object.keys(categoryConflicts).forEach(category => {
        const traits = categoryConflicts[category];
        if (traits.length > 1) {
          console.log(`[custom-render] ⚠️  Conflicto detectado en categoría ${category}:`);
          traits.forEach((trait, index) => {
            const status = index === traits.length - 1 ? '✅ SELECCIONADO' : '❌ DESCARTADO';
            console.log(`[custom-render]   ${status} - Trait ${trait.id} (${trait.name})`);
          });
        }
        
        // Usar solo el último trait de la categoría
        const lastTrait = traits[traits.length - 1];
        customTraits[category] = lastTrait.id.toString();
        console.log(`[custom-render] Final: Categoría ${category} = Trait ${lastTrait.id} (${lastTrait.name})`);
      });
    }

    console.log(`[custom-render] Traits personalizados:`, customTraits);

    // Conectar con los contratos
    console.log('[custom-render] Conectando con los contratos...');
    const { core, traitsExtension } = await getContracts();

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

    // Obtener skin del token
    console.log('[custom-render] Obteniendo skin del token...');
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log('[custom-render] Skin info:', {
      skinId,
      skinName
    });

    // Obtener traits equipados actuales
    console.log('[custom-render] Obteniendo traits equipados actuales...');
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    // Crear mapa de traits actuales
    const currentTraits = {};
    categories.forEach((category, index) => {
      currentTraits[normalizeCategory(category)] = traitIds[index].toString();
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

    // DETECCIÓN DE ANIMACIONES
    console.log('[custom-render] Iniciando detección de animaciones...');
    
    // Cargar datos de traits.json para verificar metadata
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    let labmetadata;
    try {
      const labmetadataBuffer = fs.readFileSync(labmetadataPath);
      labmetadata = JSON.parse(labmetadataBuffer.toString());
    } catch (error) {
      console.warn('[custom-render] No se pudo cargar traits.json para detección de animaciones');
      labmetadata = { traits: [] };
    }

    // Detectar si hay traits animados
    const hasAnyAnimation = await Promise.all(
      Object.entries(finalTraits).map(async ([category, traitId]) => {
        const traitPath = `${category}/${traitId}.svg`;
        const traitData = labmetadata.traits.find(t => t.tokenId === parseInt(traitId));
        const isAnimated = await isTraitAnimated(traitData, traitPath);
        
        if (isAnimated) {
          console.log(`[custom-render] Trait animado detectado: ${category}/${traitId}`);
        }
        
        return isAnimated;
      })
    ).then(results => results.some(Boolean));

    console.log(`[custom-render] Animaciones detectadas: ${hasAnyAnimation}`);

    // Si hay animaciones, generar GIF (por ahora PNG con indicador)
    if (hasAnyAnimation) {
      console.log('[custom-render] Generando formato animado...');
      const animatedBuffer = await generateAnimatedGif(finalTraits, baseImagePath, skinTraitPath);
      
      // Configurar headers para evitar cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Enviar imagen animada
      res.setHeader('Content-Type', 'image/png'); // Por ahora PNG, en el futuro GIF
      res.setHeader('Content-Length', animatedBuffer.length);
      res.send(animatedBuffer);
      
      console.log('[custom-render] Renderizado animado completado exitosamente');
      return;
    }

    // Si no hay animaciones, continuar con renderizado PNG normal
    console.log('[custom-render] Generando PNG estático...');

    // Crear canvas con fondo blanco
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    console.log('[custom-render] Canvas creado con fondo blanco');

    // Función para cargar y renderizar SVG
    const loadAndRenderSvg = async (path) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/traits/${path}`;
        console.log(`[custom-render] Cargando imagen: ${imageUrl}`);

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
        console.error(`[custom-render] Error cargando SVG ${path}:`, error.message);
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

    // 1. PRIMERO: Renderizar BACKGROUND si existe
    if (finalTraits['BACKGROUND']) {
      const bgPath = `BACKGROUND/${finalTraits['BACKGROUND']}.svg`;
      console.log(`[custom-render] PASO 1 - Cargando background: ${bgPath}`);
      
      const bgImage = await loadAndRenderSvg(bgPath);
      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, 1000, 1000);
        console.log('[custom-render] PASO 1 - Background renderizado correctamente');
      }
    }

    // 2. SEGUNDO: Renderizar el SKIN (Adrian base o excepción)
    console.log('[custom-render] PASO 2 - Iniciando carga del skin');
    
    // Si hay un trait de skin excepcional, usarlo en lugar del skin base
    if (skinTraitPath) {
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

    // 3. TERCERO: Renderizar resto de traits
    console.log('[custom-render] PASO 3 - Iniciando renderizado de traits adicionales');
    // Nuevo orden de renderizado con EYES después de HEAD y RANDOMSHIT después de SKIN
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'HEAD', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'SWAG', 'FLOPPY DISCS', 'PAGERS', 'RANDOMSHIT'];

    for (const category of traitOrder) {
      if (finalTraits[category]) {
        const traitPath = `${category}/${finalTraits[category]}.svg`;
        console.log(`[custom-render] PASO 3 - Cargando trait: ${traitPath}`);

        const traitImage = await loadAndRenderSvg(traitPath);
        if (traitImage) {
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
          console.log(`[custom-render] PASO 3 - Trait ${category} renderizado correctamente`);
        }
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
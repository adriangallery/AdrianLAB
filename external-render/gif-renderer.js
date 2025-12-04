import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { Gif, GifFrame, BitmapImage, GifUtil } from 'gifwrap';
import Jimp from 'jimp';
import crypto from 'crypto';
import { renderImage } from './renderer.js';

// Caché en memoria para conversiones SVG→PNG
const svgPngCache = new Map();
const SVG_PNG_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Obtiene una conversión SVG→PNG cacheada
 */
function getCachedSvgPng(svgContent) {
  const hash = crypto.createHash('md5').update(svgContent).digest('hex');
  
  if (!svgPngCache.has(hash)) return null;
  
  const { pngBuffer, expiry } = svgPngCache.get(hash);
  
  if (expiry < Date.now()) {
    svgPngCache.delete(hash);
    return null;
  }
  
  return pngBuffer;
}

/**
 * Guarda una conversión SVG→PNG en caché
 */
function setCachedSvgPng(svgContent, pngBuffer) {
  const hash = crypto.createHash('md5').update(svgContent).digest('hex');
  svgPngCache.set(hash, {
    pngBuffer,
    expiry: Date.now() + SVG_PNG_TTL
  });
}

/**
 * Carga un trait SVG y lo convierte a imagen
 */
async function loadTraitImage(traitId, baseUrl) {
  try {
    let imageUrl;
    const traitIdNum = parseInt(traitId);
    
    if (traitIdNum >= 30000 && traitIdNum <= 35000) {
      imageUrl = `https://adrianzero.com/designs/${traitId}.svg`;
    } else if (traitIdNum >= 100001 && traitIdNum <= 101003) {
      imageUrl = `${baseUrl}/labimages/ogpunks/${traitId}.svg`;
    } else {
      imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
    }
    
    console.log(`[gif-renderer] Cargando trait ${traitId} desde: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    const svgContent = Buffer.from(svgBuffer);
    
    // Intentar obtener del caché SVG→PNG primero
    const cachedPng = getCachedSvgPng(svgContent.toString());
    if (cachedPng) {
      const image = await loadImage(cachedPng);
      console.log(`[gif-renderer] Trait ${traitId} cargado desde caché`);
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
    
    // Guardar en caché SVG→PNG
    setCachedSvgPng(svgContent.toString(), pngBuffer);
    
    const image = await loadImage(pngBuffer);
    console.log(`[gif-renderer] Trait ${traitId} cargado y convertido a PNG`);
    return image;
  } catch (error) {
    console.error(`[gif-renderer] Error cargando trait ${traitId}:`, error.message);
    return null;
  }
}

/**
 * Genera un frame individual combinando base AdrianZERO + trait específico
 */
async function generateFrame(renderData, traitId, baseUrl) {
  console.log(`[gif-renderer] Generando frame para token ${renderData.tokenId}, trait ${traitId || 'none'}`);
  
  // 1. Renderizar base AdrianZERO (usando el renderer existente)
  const basePng = await renderImage(renderData, baseUrl);
  const baseImage = await loadImage(basePng);
  
  // 2. Si no hay trait, retornar solo la base
  if (!traitId) {
    return basePng;
  }
  
  // 3. Cargar trait
  const traitImage = await loadTraitImage(traitId, baseUrl);
  if (!traitImage) {
    console.warn(`[gif-renderer] No se pudo cargar trait ${traitId}, usando solo base`);
    return basePng;
  }
  
  // 4. Crear canvas y combinar base + trait
  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext('2d');
  
  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1000, 1000);
  
  // Dibujar base
  ctx.drawImage(baseImage, 0, 0, 1000, 1000);
  
  // Dibujar trait encima
  ctx.drawImage(traitImage, 0, 0, 1000, 1000);
  
  // Convertir a buffer PNG
  const frameBuffer = canvas.toBuffer('image/png');
  console.log(`[gif-renderer] Frame generado (${frameBuffer.length} bytes)`);
  
  return frameBuffer;
}

/**
 * Genera un GIF completo con múltiples frames
 */
export async function renderGif(payload, baseUrl) {
  const {
    tokenId,
    frames,
    pattern,
    delay,
    // Datos del render base (para renderImage)
    generation,
    skinType,
    finalTraits: originalFinalTraits,
    appliedSerum,
    serumSuccess,
    hasAdrianGFSerum,
    serumHistory,
    failedSerumType,
    baseImagePath,
    skintraitPath,
    skinTraitPath,
    isCloseup,
    traitsMapping,
    tagInfo,
    samuraiImageIndex
  } = payload;
  
  console.log(`[gif-renderer] 🎬 Iniciando generación de GIF:`, {
    tokenId,
    frames,
    pattern,
    delay
  });
  
  // Validar patrón
  if (!pattern || pattern.length === 0) {
    throw new Error('Pattern debe contener al menos un traitId');
  }
  
  // Preparar datos de render base (sin el trait que vamos a intercalar)
  const baseRenderData = {
    tokenId,
    generation,
    skinType,
    finalTraits: originalFinalTraits || {},
    appliedSerum,
    serumSuccess,
    hasAdrianGFSerum,
    serumHistory,
    failedSerumType,
    baseImagePath,
    skintraitPath,
    skinTraitPath,
    isCloseup: false, // GIFs siempre a tamaño completo
    traitsMapping,
    tagInfo,
    samuraiImageIndex
  };
  
  // Generar frames
  const frameBuffers = [];
  for (let i = 0; i < frames; i++) {
    // Determinar qué trait usar según el patrón (ciclar si es necesario)
    const patternIndex = i % pattern.length;
    const traitId = pattern[patternIndex];
    
    console.log(`[gif-renderer] Generando frame ${i + 1}/${frames} con trait ${traitId}`);
    
    const frameBuffer = await generateFrame(baseRenderData, traitId, baseUrl);
    frameBuffers.push(frameBuffer);
  }
  
  // Convertir frames PNG a GifFrame
  const gifFrames = [];
  const delayCentisecs = Math.round(delay / 10); // Convertir ms a centisegundos
  
  console.log(`[gif-renderer] Convirtiendo ${frameBuffers.length} frames PNG a GifFrame...`);
  
  for (let i = 0; i < frameBuffers.length; i++) {
    const frameBuffer = frameBuffers[i];
    
    // Validar que el buffer existe y es válido
    if (!frameBuffer || !Buffer.isBuffer(frameBuffer)) {
      throw new Error(`Frame ${i + 1} tiene un buffer inválido`);
    }
    
    try {
      // Cargar PNG en Jimp
      let JimpInstance = Jimp;
      if (!JimpInstance || typeof JimpInstance.read !== 'function') {
        console.log(`[gif-renderer] Jimp no disponible estáticamente, usando importación dinámica...`);
        const jimpModule = await import('jimp');
        JimpInstance = jimpModule.default || jimpModule;
        
        if (!JimpInstance || typeof JimpInstance.read !== 'function') {
          throw new Error('Jimp no está disponible después de importación dinámica');
        }
      }
      
      const jimpImage = await JimpInstance.read(frameBuffer);
      
      if (!jimpImage || !jimpImage.bitmap) {
        throw new Error(`Jimp no pudo leer el frame ${i + 1}`);
      }
      
      // Crear BitmapImage desde el bitmap de Jimp
      const bitmap = new BitmapImage(jimpImage.bitmap);
      
      // Crear GifFrame con delay
      const gifFrame = new GifFrame(delayCentisecs, bitmap);
      gifFrames.push(gifFrame);
      
      console.log(`[gif-renderer] Frame ${i + 1} convertido exitosamente`);
    } catch (error) {
      console.error(`[gif-renderer] Error procesando frame ${i + 1}:`, error.message);
      throw new Error(`Error procesando frame ${i + 1}: ${error.message}`);
    }
  }
  
  // Crear GIF
  console.log(`[gif-renderer] Creando GIF con ${gifFrames.length} frames...`);
  const outputGif = new Gif(gifFrames, {
    loops: 0, // Loop infinito
    colorScope: Gif.ColorScope.DEFAULT
  });
  
  // Escribir GIF a buffer
  const gifBuffer = await GifUtil.write(outputGif);
  console.log(`[gif-renderer] ✅ GIF generado exitosamente (${gifBuffer.length} bytes)`);
  
  return gifBuffer;
}


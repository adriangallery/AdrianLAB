import { Resvg } from '@resvg/resvg-js';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import GifEncoder from 'gif-encoder-2';
import { createCanvas, loadImage } from 'canvas';

/**
 * V2: Endpoint avanzado con skins base, traits fijos, delays personalizados y movimiento XY
 * 
 * Esta versión está preparada para futuras mejoras y nuevas funcionalidades.
 * La v1 (test-gif-simple.js) se mantiene funcional para compatibilidad.
 * 
 * Parámetros:
 * - method: 'gifwrap' | 'sharp' (default: gifwrap)
 * - base: ID del skin base (ej: adriangf, alien, darkadrian)
 * - fixed: IDs de traits fijos separados por coma (ej: 1028,662)
 * - frames: trait:delay separados por coma (ej: 32:200,870:400,14:300)
 * - move: movimiento en formato layer.id:type:param1:param2 (ej: fixed.1028:circular:50:2)
 * - svgs, delay: formato antiguo para compatibilidad
 */

// Mapa de skins especiales y sus rutas
const SPECIAL_SKINS = {
  // AdrianGF skins
  'adriangf': '/traits/ADRIANGF/GF1/GF1-Fair.svg',
  'adriangf-fair': '/traits/ADRIANGF/GF1/GF1-Fair.svg',
  'adriangf-tan': '/traits/ADRIANGF/GF1/GF1-Tan.svg',
  'adriangf-albino': '/traits/ADRIANGF/GF1/GEN1_Albino.svg',
  
  // Adrian skins (GEN0)
  'medium': '/traits/ADRIAN/GEN0-Medium.svg',
  'dark': '/traits/ADRIAN/GEN0-Dark.svg',
  'darkadrian': '/traits/ADRIAN/GEN0-Dark.svg',
  'alien': '/traits/ADRIAN/GEN0-Alien.svg',
  'albino': '/traits/ADRIAN/GEN0-Albino.svg',
  
  // Mannequins
  'blankmannequin': '/labimages/blankmannequin.svg',
  'mannequin': '/labimages/mannequin.svg'
};

/**
 * Parsear parámetros de movimiento
 * Formato: layer.id:type:param1:param2:...
 * Ejemplo: fixed.1028:circular:50:2
 */
function parseMovements(moveParams) {
  if (!moveParams) return [];
  
  // Puede ser string único o array
  const moves = Array.isArray(moveParams) ? moveParams : [moveParams];
  
  return moves.map(moveStr => {
    const parts = moveStr.split(':');
    if (parts.length < 2) {
      throw new Error(`Formato de movimiento inválido: ${moveStr}`);
    }
    
    const [layerSpec, type, ...params] = parts;
    
    // Parsear layer: "base", "fixed.1028", "variable"
    const layerParts = layerSpec.split('.');
    const layerType = layerParts[0];
    const layerId = layerParts.length > 1 ? layerParts[1] : null;
    
    return {
      layerType,    // 'base', 'fixed', 'variable'
      layerId,      // ID específico si es fixed, null otherwise
      type,         // 'linear', 'circular', 'bounce', etc.
      params        // Array de parámetros específicos del movimiento
    };
  });
}

/**
 * Parsear parámetros del query
 */
function parseQueryParams(query) {
  const { method = 'gifwrap', base, fixed, frames, move, gif, gifBackground, svgs, delay } = query;
  
  // Soporte para formato antiguo (compatibilidad hacia atrás)
  if (svgs && delay) {
    return {
      method,
      base: null,
      fixed: [],
      frames: svgs.split(',').map(id => ({ 
        id: id.trim(), 
        delay: parseInt(delay) 
      })),
      movements: [],
      gifId: null
    };
  }
  
  // Nuevo formato con delays individuales
  if (!frames) {
    throw new Error('Se requiere el parámetro "frames" (ej: frames=32:200,870:400)');
  }
  
  // GIF puede venir como "gif" o "gifBackground" (sinónimos)
  const gifId = gif || gifBackground || null;
  
  return {
    method,
    base: base || null,
    fixed: fixed ? fixed.split(',').map(id => id.trim()) : [],
    frames: frames.split(',').map(frameStr => {
      const parts = frameStr.split(':');
      const id = parts[0].trim();
      const delayMs = parts[1] ? parseInt(parts[1]) : 500;
      
      if (isNaN(delayMs)) {
        throw new Error(`Delay inválido en frame: ${frameStr}`);
      }
      
      return { id, delay: delayMs };
    }),
    movements: parseMovements(move),
    gifId: gifId ? gifId.toString() : null
  };
}

/**
 * Cargar y extraer frames de un GIF pre-generado
 * Retorna los frames y el tamaño original del GIF
 */
async function loadGifFrames(gifId, targetWidth = null, targetHeight = null) {
  console.log(`[loadGifFrames] Cargando GIF: ${gifId}`);
  
  // Construir URL del GIF
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
  const gifUrl = `${baseUrl}/labimages/${gifId}.gif`;
  
  console.log(`[loadGifFrames] URL: ${gifUrl}`);
  
  // Descargar GIF
  const response = await fetch(gifUrl);
  if (!response.ok) {
    throw new Error(`Failed to load GIF ${gifId}: ${response.status} ${response.statusText}`);
  }
  
  const gifBuffer = await response.arrayBuffer();
  console.log(`[loadGifFrames] GIF descargado: ${gifBuffer.byteLength} bytes`);
  
  // Leer GIF con gifwrap
  const gif = await GifUtil.read(Buffer.from(gifBuffer));
  const gifFrames = gif.frames;
  
  console.log(`[loadGifFrames] GIF parseado: ${gifFrames.length} frames`);
  
  // Extraer paleta de colores del GIF original para preservar calidad
  // La paleta está en gif.globalColorTable si existe
  let originalPalette = null;
  if (gif.globalColorTable && gif.globalColorTable.length > 0) {
    originalPalette = gif.globalColorTable;
    console.log(`[loadGifFrames] Paleta original detectada: ${originalPalette.length} colores`);
  }
  
  // Detectar tamaño original del GIF desde el primer frame
  const originalWidth = gifFrames[0]?.bitmap?.width || 400;
  const originalHeight = gifFrames[0]?.bitmap?.height || 400;
  console.log(`[loadGifFrames] Tamaño original del GIF: ${originalWidth}x${originalHeight}`);
  
  // Usar tamaño original si no se especifica target
  const finalWidth = targetWidth || originalWidth;
  const finalHeight = targetHeight || originalHeight;
  const needsResize = finalWidth !== originalWidth || finalHeight !== originalHeight;
  
  if (needsResize) {
    console.log(`[loadGifFrames] Redimensionando de ${originalWidth}x${originalHeight} a ${finalWidth}x${finalHeight}`);
  } else {
    console.log(`[loadGifFrames] Manteniendo tamaño original: ${originalWidth}x${originalHeight}`);
  }
  
  // Procesar cada frame: convertir a PNG y redimensionar si es necesario
  const processedFrames = [];
  
  for (let i = 0; i < gifFrames.length; i++) {
    const frame = gifFrames[i];
    const delayMs = (frame.delayCentisecs || 10) * 10; // Convertir a ms
    
    console.log(`[loadGifFrames] Procesando frame ${i + 1}/${gifFrames.length}, delay: ${delayMs}ms`);
    
    // Convertir GifFrame a PNG buffer usando canvas
    const frameBitmap = frame.bitmap;
    
    // Crear canvas temporal para el frame
    const frameCanvas = createCanvas(frameBitmap.width, frameBitmap.height);
    const frameCtx = frameCanvas.getContext('2d');
    
    // Obtener datos de imagen del frame (bitmap.data es un Buffer en formato RGBA)
    const imageData = frameCtx.createImageData(frameBitmap.width, frameBitmap.height);
    const data = imageData.data;
    
    // Copiar datos del bitmap al ImageData
    const frameData = frameBitmap.data;
    for (let j = 0; j < data.length && j < frameData.length; j++) {
      data[j] = frameData[j];
    }
    
    frameCtx.putImageData(imageData, 0, 0);
    
    // Convertir canvas a PNG buffer
    const pngBuffer = frameCanvas.toBuffer('image/png');
    
    // Redimensionar solo si es necesario
    // Usar configuración que preserve mejor la calidad y evite pixel repetition
    let finalBuffer = pngBuffer;
    if (needsResize) {
      finalBuffer = await sharp(pngBuffer)
        .resize(finalWidth, finalHeight, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparente
          kernel: 'lanczos3', // Kernel de alta calidad para evitar pixel repetition
          withoutEnlargement: false
        })
        .png({
          quality: 100, // Máxima calidad PNG
          compressionLevel: 9, // Máxima compresión sin pérdida
          palette: false // No aplicar paleta en PNG, lo haremos después en GIF
        })
        .toBuffer();
    }
    
    processedFrames.push({
      pngBuffer: finalBuffer,
      delay: delayMs,
      index: i
    });
  }
  
  console.log(`[loadGifFrames] ✅ ${processedFrames.length} frames procesados`);
  return {
    frames: processedFrames,
    width: finalWidth,
    height: finalHeight,
    originalWidth,
    originalHeight,
    originalPalette: originalPalette,
    originalGif: gif // Guardar referencia al GIF original para preservar metadata
  };
}

/**
 * Convertir SVG a PNG
 */
async function svgToPng(id, method, width = 400) {
  console.log(`[svgToPng] Cargando: ${id}, método: ${method}`);
  
  // Determinar la URL del SVG
  let url;
  const lowerid = id.toLowerCase();
  
  if (SPECIAL_SKINS[lowerid]) {
    url = `https://adrianlab.vercel.app${SPECIAL_SKINS[lowerid]}`;
    console.log(`[svgToPng] Skin especial detectado: ${url}`);
  } else if (id.endsWith('.svg')) {
    url = `https://adrianlab.vercel.app/labimages/${id}`;
  } else {
    url = `https://adrianlab.vercel.app/labimages/${id}.svg`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${id}: ${response.status} ${response.statusText}`);
  }
  
  if (method === 'sharp') {
    const svgBuffer = await response.arrayBuffer();
    return await sharp(Buffer.from(svgBuffer))
      .resize(width, width, { 
        fit: 'contain', 
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparente
      })
      .png()
      .toBuffer();
  } else {
    const svgContent = await response.text();
    const resvg = new Resvg(Buffer.from(svgContent), {
      fitTo: { mode: 'width', value: width },
      background: 'rgba(255, 255, 255, 0)' // Transparente
    });
    return resvg.render().asPng();
  }
}

/**
 * Calcular posición según tipo de movimiento
 */
function calculatePosition(movement, frameIndex, totalFrames) {
  if (!movement) {
    return { x: 0, y: 0, scale: 1, rotation: 0 };
  }
  
  // Calcular progress: 0.0 (primer frame) a 1.0 (último frame)
  // Si solo hay 1 frame, progress = 0
  const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const { type, params } = movement;
  
  console.log(`[calculatePosition] Frame ${frameIndex}/${totalFrames}, progress: ${progress.toFixed(3)}, type: ${type}, params: [${params.join(', ')}]`);
  
  switch (type) {
    case 'linear':
      return calculateLinear(params, progress);
    case 'circular':
      return calculateCircular(params, progress);
    case 'bounce':
      return calculateBounce(params, progress);
    case 'shake':
      return calculateShake(params, frameIndex);
    case 'orbit':
      return calculateOrbit(params, progress);
    case 'zoom':
      return calculateZoom(params, progress);
    case 'path':
      return calculatePath(params, progress);
    default:
      console.warn(`[calculatePosition] Tipo de movimiento desconocido: ${type}`);
      return { x: 0, y: 0, scale: 1, rotation: 0 };
  }
}

function calculateLinear(params, progress) {
  let x = 0, y = 0;
  
  for (let i = 0; i < params.length; i++) {
    const param = params[i].toLowerCase();
    const value = parseFloat(params[i + 1]) || 0;
    
    if (param === 'x') {
      x = value * progress;
      i++;
    } else if (param === 'y') {
      y = value * progress;
      i++;
    }
  }
  
  return { x, y, scale: 1, rotation: 0 };
}

function calculateCircular(params, progress) {
  const radius = parseFloat(params[0]) || 50;
  const rotations = parseFloat(params[1]) || 1;
  const direction = params[2] === 'cw' ? 1 : -1;
  
  const angle = progress * rotations * Math.PI * 2 * direction;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  
  return { x, y, scale: 1, rotation: 0 };
}

function calculateBounce(params, progress) {
  const direction = params[0].toLowerCase(); // 'x' o 'y'
  const distance = parseFloat(params[1]) || 50;
  const bounces = parseInt(params[2]) || 3;
  
  // Efecto bounce usando función seno
  const bounceProgress = Math.abs(Math.sin(progress * Math.PI * bounces));
  const offset = distance * bounceProgress;
  
  if (direction === 'x') {
    return { x: offset, y: 0, scale: 1, rotation: 0 };
  } else {
    return { x: 0, y: offset, scale: 1, rotation: 0 };
  }
}

function calculateShake(params, frameIndex) {
  const intensity = parseFloat(params[0]) || 10;
  const speed = params[1] === 'fast' ? 0.5 : params[1] === 'slow' ? 0.1 : 0.3;
  
  // Movimiento aleatorio pero determinístico
  const seed = frameIndex * speed;
  const x = (Math.sin(seed) + Math.cos(seed * 2)) * intensity;
  const y = (Math.cos(seed) + Math.sin(seed * 3)) * intensity;
  
  return { x, y, scale: 1, rotation: 0 };
}

function calculateOrbit(params, progress) {
  const radius = parseFloat(params[0]) || 80;
  const rotations = parseFloat(params[1]) || 2;
  const direction = params[2] === 'ccw' ? -1 : 1;
  
  const angle = progress * rotations * Math.PI * 2 * direction;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  
  return { x, y, scale: 1, rotation: 0 };
}

function calculateZoom(params, progress) {
  const minScale = parseFloat(params[0]) || 0.5;
  const maxScale = parseFloat(params[1]) || 1.5;
  const easing = params[2] === 'bounce' ? 'bounce' : 'linear';
  
  let scale;
  if (easing === 'bounce') {
    const bounceProgress = Math.abs(Math.sin(progress * Math.PI * 2));
    scale = minScale + (maxScale - minScale) * bounceProgress;
  } else {
    // Ease in-out
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    scale = minScale + (maxScale - minScale) * eased;
  }
  
  return { x: 0, y: 0, scale, rotation: 0 };
}

function calculatePath(params, progress) {
  // Path: x1,y1:x2,y2:x3,y3:...
  const points = params.map(p => {
    const [x, y] = p.split(',').map(v => parseFloat(v));
    return { x: x || 0, y: y || 0 };
  });
  
  if (points.length < 2) {
    return { x: 0, y: 0, scale: 1, rotation: 0 };
  }
  
  // Interpolación lineal entre puntos
  const segmentLength = 1 / (points.length - 1);
  const segmentIndex = Math.min(Math.floor(progress / segmentLength), points.length - 2);
  const segmentProgress = (progress - segmentIndex * segmentLength) / segmentLength;
  
  const p1 = points[segmentIndex];
  const p2 = points[segmentIndex + 1];
  
  const x = p1.x + (p2.x - p1.x) * segmentProgress;
  const y = p1.y + (p2.y - p1.y) * segmentProgress;
  
  return { x, y, scale: 1, rotation: 0 };
}

/**
 * Encontrar movimiento para una capa específica
 */
function findMovement(movements, layerType, layerId = null) {
  if (!movements || movements.length === 0) return null;
  
  return movements.find(m => {
    if (m.layerType !== layerType) return false;
    
    // Para fixed, comparar layerId (convertir ambos a string para comparación)
    if (layerType === 'fixed') {
      const mId = String(m.layerId || '');
      const lId = String(layerId || '');
      if (mId !== lId) return false;
    }
    
    // Para base y variable, no deben tener layerId
    if (layerType === 'base' && m.layerId !== null && m.layerId !== undefined) return false;
    if (layerType === 'variable' && m.layerId !== null && m.layerId !== undefined) return false;
    
    return true;
  });
}

/**
 * Componer múltiples capas PNG en un solo canvas con transformaciones
 */
async function compositeFrameWithTransforms(layers, width = 400, height = 400) {
  console.log(`[compositeFrame] Componiendo ${layers.length} capas con transformaciones`);
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Canvas transparente por defecto (no rellenar fondo)
  // Esto permite que el GIF tenga transparencia
  
  // Dibujar cada capa en orden con transformaciones
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const { x = 0, y = 0, scale = 1, rotation = 0 } = layer.transform || {};
    
    console.log(`[compositeFrame] Dibujando capa ${i + 1}/${layers.length}: ${layer.id} (${layer.type}) - transform: x=${x.toFixed(1)}, y=${y.toFixed(1)}, scale=${scale.toFixed(2)}, rotation=${rotation.toFixed(1)}°`);
    
    const img = await loadImage(layer.pngBuffer);
    
    ctx.save();
    
    // Aplicar transformaciones desde el centro del canvas
    ctx.translate(width / 2 + x, height / 2 + y);
    if (rotation !== 0) {
      ctx.rotate(rotation * Math.PI / 180);
    }
    if (scale !== 1) {
      ctx.scale(scale, scale);
    }
    
    // Dibujar centrado
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    
    ctx.restore();
  }
  
  return canvas.toBuffer('image/png');
}

/**
 * Generar un frame con múltiples capas y transformaciones
 * Ahora soporta GIF como background
 */
async function generateLayeredFrame(baseId, fixedIds, variableId, method, movements, frameIndex, totalFrames, gifFrame = null, width = 400, height = 400) {
  const layers = [];
  
  // 0. GIF Background (si existe) - va primero (más abajo)
  if (gifFrame) {
    layers.push({
      id: 'gif-background',
      pngBuffer: gifFrame.pngBuffer,
      type: 'gif',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }
    });
  }
  
  // 1. Skin base (si existe)
  if (baseId) {
    const basePng = await svgToPng(baseId, method, width);
    const baseMovement = findMovement(movements, 'base');
    const baseTransform = calculatePosition(baseMovement, frameIndex, totalFrames);
    
    layers.push({ 
      id: baseId, 
      pngBuffer: basePng, 
      type: 'base',
      transform: baseTransform
    });
  }
  
  // 2. Traits fijos
  for (const fixedId of fixedIds) {
    const fixedPng = await svgToPng(fixedId, method, width);
    const fixedMovement = findMovement(movements, 'fixed', fixedId);
    
    if (fixedMovement) {
      console.log(`[generateLayeredFrame] Movimiento encontrado para fixed.${fixedId}: ${fixedMovement.type}`);
    } else {
      console.log(`[generateLayeredFrame] No se encontró movimiento para fixed.${fixedId} (movimientos disponibles: ${movements.map(m => `${m.layerType}.${m.layerId || ''}`).join(', ')})`);
    }
    
    const fixedTransform = calculatePosition(fixedMovement, frameIndex, totalFrames);
    
    layers.push({ 
      id: fixedId, 
      pngBuffer: fixedPng, 
      type: 'fixed',
      transform: fixedTransform
    });
  }
  
  // 3. Trait variable del frame
  if (variableId) {
    const variablePng = await svgToPng(variableId, method, width);
    const varMovement = findMovement(movements, 'variable');
    const varTransform = calculatePosition(varMovement, frameIndex, totalFrames);
    
    layers.push({ 
      id: variableId, 
      pngBuffer: variablePng, 
      type: 'variable',
      transform: varTransform
    });
  }
  
  // Componer todas las capas con transformaciones usando el tamaño del GIF
  return await compositeFrameWithTransforms(layers, width, height);
}

/**
 * Enfoque A: gifwrap con sistema de capas, movimientos y GIFs pre-generados
 */
async function generateGifWithGifwrap(config) {
  const { base, fixed, frames, movements, gifId } = config;
  
  console.log(`[GIFWRAP] Generando GIF con capas y movimientos:`);
  console.log(`[GIFWRAP] - Base: ${base || 'ninguna'}`);
  console.log(`[GIFWRAP] - Fixed: [${fixed.join(', ') || 'ninguno'}]`);
  console.log(`[GIFWRAP] - Frames: ${frames.length}`);
  console.log(`[GIFWRAP] - Movimientos: ${movements.length}`);
  console.log(`[GIFWRAP] - GIF Background: ${gifId || 'ninguno'}`);
  
  // Cargar frames del GIF si existe
  let gifFramesData = null;
  let gifWidth = 400;
  let gifHeight = 400;
  let originalGifPalette = null;
  if (gifId) {
    const gifData = await loadGifFrames(gifId);
    gifFramesData = gifData.frames;
    gifWidth = gifData.width;
    gifHeight = gifData.height;
    originalGifPalette = gifData.originalPalette;
    console.log(`[GIFWRAP] GIF cargado: ${gifFramesData.length} frames, tamaño: ${gifWidth}x${gifHeight}`);
    if (originalGifPalette) {
      console.log(`[GIFWRAP] Paleta original preservada: ${originalGifPalette.length} colores`);
    }
  }
  
  const outputGifFrames = [];
  const totalSvgFrames = frames.length;
  
  // Si hay GIF, el GIF define el número total de frames (cicla si es necesario)
  // Si no hay GIF, usar frames SVG
  const totalFrames = gifFramesData ? gifFramesData.length : totalSvgFrames;
  
  for (let i = 0; i < totalFrames; i++) {
    // Determinar qué frame del GIF usar (ciclar si es necesario)
    const gifFrameIndex = gifFramesData ? (i % gifFramesData.length) : null;
    const gifFrame = gifFramesData ? gifFramesData[gifFrameIndex] : null;
    
    // Determinar qué trait SVG usar (ciclar si hay más frames GIF que SVG)
    const svgFrameIndex = i % totalSvgFrames;
    const svgFrame = frames[svgFrameIndex];
    
    console.log(`[GIFWRAP] Frame ${i + 1}/${totalFrames}: GIF frame ${gifFrameIndex !== null ? gifFrameIndex + 1 : 'N/A'}, SVG trait ${svgFrame.id}`);
    
    // Generar frame con capas, transformaciones y GIF background
    // Pasar el tamaño del GIF para mantener la calidad
    const compositePng = await generateLayeredFrame(
      base,
      fixed,
      svgFrame.id,
      'resvg',
      movements,
      i,
      totalFrames,
      gifFrame,
      gifWidth,
      gifHeight
    );
    
    console.log(`[GIFWRAP] Frame ${i + 1} compuesto, tamaño: ${compositePng.length} bytes`);
    
    // Convertir a GifFrame
    const pngImage = PNG.sync.read(compositePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    // Si hay GIF de fondo, SIEMPRE usar el delay del GIF, no del SVG
    const delayMs = gifFramesData ? gifFrame.delay : svgFrame.delay;
    const delayCentisecs = Math.round(delayMs / 10);
    const outputFrame = new GifFrame(bitmapImage, { delayCentisecs });
    outputGifFrames.push(outputFrame);
  }
  
  // Cuantizar colores preservando la paleta original si existe
  console.log(`[GIFWRAP] Cuantizando ${outputGifFrames.length} frames...`);
  if (originalGifPalette && originalGifPalette.length > 0) {
    // Si tenemos paleta original, usar cuantización que la preserve mejor
    // Usar el número de colores de la paleta original (máximo 256)
    const paletteSize = Math.min(originalGifPalette.length, 256);
    console.log(`[GIFWRAP] Usando paleta original con ${paletteSize} colores`);
    GifUtil.quantizeSorokin(outputGifFrames, paletteSize);
  } else {
    // Sin paleta original, usar cuantización estándar a 256
    GifUtil.quantizeSorokin(outputGifFrames, 256);
  }
  
  // Generar GIF
  console.log(`[GIFWRAP] Generando GIF...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(outputGifFrames, { loops: 0 });
  
  console.log(`[GIFWRAP] GIF completado: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}

/**
 * Enfoque B: sharp + gif-encoder-2 con sistema de capas, movimientos y GIFs pre-generados
 */
async function generateGifWithSharp(config) {
  const { base, fixed, frames, movements, gifId } = config;
  let width = 400;
  let height = 400;
  
  console.log(`[SHARP] Generando GIF con capas y movimientos:`);
  console.log(`[SHARP] - Base: ${base || 'ninguna'}`);
  console.log(`[SHARP] - Fixed: [${fixed.join(', ') || 'ninguno'}]`);
  console.log(`[SHARP] - Frames: ${frames.length}`);
  console.log(`[SHARP] - Movimientos: ${movements.length}`);
  console.log(`[SHARP] - GIF Background: ${gifId || 'ninguno'}`);
  
  // Cargar frames del GIF si existe
  let gifFramesData = null;
  if (gifId) {
    const gifData = await loadGifFrames(gifId);
    gifFramesData = gifData.frames;
    width = gifData.width;
    height = gifData.height;
    console.log(`[SHARP] GIF cargado: ${gifFramesData.length} frames, tamaño: ${width}x${height}`);
  }
  
  // Inicializar encoder
  const encoder = new GifEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(10);
  
  // Si hay GIF, el GIF define el número total de frames (cicla si es necesario)
  // Si no hay GIF, usar frames SVG
  const totalSvgFrames = frames.length;
  const totalFrames = gifFramesData ? gifFramesData.length : totalSvgFrames;
  
  for (let i = 0; i < totalFrames; i++) {
    // Determinar qué frame del GIF usar (ciclar si es necesario)
    const gifFrameIndex = gifFramesData ? (i % gifFramesData.length) : null;
    const gifFrame = gifFramesData ? gifFramesData[gifFrameIndex] : null;
    
    // Determinar qué trait SVG usar (ciclar si hay más frames GIF que SVG)
    const svgFrameIndex = i % totalSvgFrames;
    const svgFrame = frames[svgFrameIndex];
    
    console.log(`[SHARP] Frame ${i + 1}/${totalFrames}: GIF frame ${gifFrameIndex !== null ? gifFrameIndex + 1 : 'N/A'}, SVG trait ${svgFrame.id}`);
    
    // Si hay GIF de fondo, SIEMPRE usar el delay del GIF, no del SVG
    const delayMs = gifFramesData ? gifFrame.delay : svgFrame.delay;
    encoder.setDelay(delayMs);
    
    // Generar frame con capas, transformaciones y GIF background
    // Pasar el tamaño del GIF para mantener la calidad
    const compositePng = await generateLayeredFrame(
      base,
      fixed,
      svgFrame.id,
      'sharp',
      movements,
      i,
      totalFrames,
      gifFrame,
      width,
      height
    );
    
    console.log(`[SHARP] Frame ${i + 1} compuesto, tamaño: ${compositePng.length} bytes`);
    
    // Agregar al encoder
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const img = await loadImage(compositePng);
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    encoder.addFrame(imageData.data);
  }
  
  encoder.finish();
  const gifBuffer = encoder.out.getData();
  
  console.log(`[SHARP] GIF completado: ${gifBuffer.length} bytes`);
  return gifBuffer;
}

/**
 * Handler principal V2
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Parsear parámetros
    const config = parseQueryParams(req.query);
    
    // Validaciones
    if (config.frames.length < 1) {
      return res.status(400).json({ 
        error: 'Se requiere al menos 1 frame',
        example: '/api/test-gif-simple-v2?frames=32:200,870:400'
      });
    }
    
    if (config.frames.length > 20) {
      return res.status(400).json({ 
        error: 'Máximo 20 frames permitidos',
        received: config.frames.length
      });
    }
    
    for (const frame of config.frames) {
      if (frame.delay < 10 || frame.delay > 5000) {
        return res.status(400).json({ 
          error: `Delay debe estar entre 10 y 5000 ms (frame: ${frame.id})`,
          received: frame.delay
        });
      }
    }
    
    console.log(`[test-gif-simple-v2] ========================================`);
    console.log(`[test-gif-simple-v2] V2: Request con capas, movimientos y GIFs`);
    console.log(`[test-gif-simple-v2] - Método: ${config.method}`);
    console.log(`[test-gif-simple-v2] - Base: ${config.base || 'ninguna'}`);
    console.log(`[test-gif-simple-v2] - Fixed: [${config.fixed.join(', ') || 'ninguno'}]`);
    console.log(`[test-gif-simple-v2] - GIF Background: ${config.gifId || 'ninguno'}`);
    console.log(`[test-gif-simple-v2] - Frames: ${config.frames.length}`);
    config.frames.forEach((f, i) => {
      console.log(`[test-gif-simple-v2]   Frame ${i + 1}: ${f.id} (${f.delay}ms)`);
    });
    console.log(`[test-gif-simple-v2] - Movimientos: ${config.movements.length}`);
    config.movements.forEach((m, i) => {
      const layerSpec = m.layerId ? `${m.layerType}.${m.layerId}` : m.layerType;
      console.log(`[test-gif-simple-v2]   Movimiento ${i + 1}: ${layerSpec} - ${m.type} (${m.params.join(', ')})`);
    });
    console.log(`[test-gif-simple-v2] ========================================`);
    
    // Generar GIF según el método
    let gifBuffer;
    
    if (config.method === 'sharp') {
      gifBuffer = await generateGifWithSharp(config);
    } else {
      gifBuffer = await generateGifWithGifwrap(config);
    }
    
    const duration = Date.now() - startTime;
    
    // Calcular estadísticas
    const totalLayers = 1 + config.fixed.length + 1; // base + fixed + variable
    const avgDelay = config.frames.reduce((sum, f) => sum + f.delay, 0) / config.frames.length;
    
    console.log(`[test-gif-simple-v2] ========================================`);
    console.log(`[test-gif-simple-v2] ✅ GIF generado exitosamente`);
    console.log(`[test-gif-simple-v2] - Método: ${config.method}`);
    console.log(`[test-gif-simple-v2] - Duración: ${duration}ms`);
    console.log(`[test-gif-simple-v2] - Tamaño: ${(gifBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`[test-gif-simple-v2] - Frames: ${config.frames.length}`);
    console.log(`[test-gif-simple-v2] - Capas por frame: ${totalLayers}`);
    console.log(`[test-gif-simple-v2] - Delay promedio: ${avgDelay.toFixed(0)}ms`);
    console.log(`[test-gif-simple-v2] ========================================`);
    
    // Headers
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', gifBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Method', config.method);
    res.setHeader('X-Duration-Ms', duration.toString());
    res.setHeader('X-Size-Bytes', gifBuffer.length.toString());
    res.setHeader('X-Size-KB', (gifBuffer.length / 1024).toFixed(2));
    res.setHeader('X-Frame-Count', config.frames.length.toString());
    res.setHeader('X-Base-Skin', config.base || 'none');
    res.setHeader('X-Fixed-Traits', config.fixed.join(',') || 'none');
    res.setHeader('X-Frame-Delays', config.frames.map(f => f.delay).join(','));
    res.setHeader('X-Layers-Per-Frame', totalLayers.toString());
    res.setHeader('X-Avg-Delay-Ms', avgDelay.toFixed(0));
    res.setHeader('X-Version', '2.0');
    res.setHeader('X-Phase', '2.0');
    res.setHeader('X-Movements-Count', config.movements.length.toString());
    res.setHeader('X-Gif-Background', config.gifId || 'none');
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[test-gif-simple-v2] ❌ ERROR:', error);
    console.error('[test-gif-simple-v2] Stack:', error.stack);
    console.error(`[test-gif-simple-v2] Duración hasta error: ${duration}ms`);
    
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      duration: `${duration}ms`,
      version: '2.0',
      phase: 2
    });
  }
}


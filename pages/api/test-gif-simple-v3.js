import { Resvg } from '@resvg/resvg-js';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import GifEncoder from 'gif-encoder-2';
import { createCanvas, loadImage } from 'canvas';

/**
 * V3: Endpoint con GIF como background visual
 * 
 * Enfoque: Los SVG y la configuración de URL controlan los frames y delays.
 * El GIF de fondo se cicla/repite como background visual.
 * 
 * Parámetros:
 * - method: 'gifwrap' | 'sharp' (default: gifwrap)
 * - base: ID del skin base (ej: adriangf, alien, darkadrian)
 * - fixed: IDs de traits fijos separados por coma (ej: 1028,662)
 * - frames: trait:delay separados por coma (ej: 32:200,870:400,14:300)
 * - move: movimiento en formato layer.id:type:param1:param2 (ej: fixed.1028:circular:50:2)
 * - gifBackground o gif: ID del GIF de fondo (se cicla como background)
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
/**
 * Detectar variantes de un trait animado (1167 -> 1167a, 1167b, etc.)
 */
async function detectAnimatedVariants(baseId) {
  const variants = [];
  const letters = 'abcdefghij'.split(''); // Solo buscar hasta 10 variantes (a-j)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
  
  // IMPORTANTE: Solo buscamos variantes con letras (ej: 1165a, 1165b)
  // NO incluimos el archivo base sin letra (ej: 1165.svg) - ese es para otros renders
  const checkPromises = letters.map(async (letter) => {
    const variantId = `${baseId}${letter}`; // Siempre con letra: 1165a, 1165b, etc.
    const url = `${baseUrl}/labimages/${variantId}.svg`;
    
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return variantId;
      }
    } catch (e) {
      // Ignorar errores
    }
    return null;
  });
  
  const results = await Promise.all(checkPromises);
  // Filtrar resultados y asegurar que solo incluimos variantes con letra
  return results.filter(v => v !== null && v !== baseId); // baseId sin letra nunca debería estar aquí, pero por seguridad
}

function parseQueryParams(query) {
  const { method = 'gifwrap', base, fixed, frames, animated, move, gif, gifBackground, adrianzero, tokenId } = query;
  
  // GIF puede venir como "gif" o "gifBackground" (sinónimos)
  const gifId = gif || gifBackground || null;
  
  // AdrianZERO tokenId puede venir como "adrianzero" o "tokenId" (sinónimos)
  const adrianZeroTokenId = adrianzero || tokenId || null;
  
  // Parsear animated traits (formato corto: animated=1167:500,1166:300)
  const animatedTraits = animated ? animated.split(',').map(animStr => {
    const parts = animStr.split(':');
    const baseId = parts[0].trim();
    const delayMs = parts[1] ? parseInt(parts[1]) : 500;
    return { baseId, delay: delayMs };
  }) : [];
  
  // Parsear frames normales
  const normalFrames = frames ? frames.split(',').map(frameStr => {
    const parts = frameStr.split(':');
    const id = parts[0].trim();
    const delayMs = parts[1] ? parseInt(parts[1]) : 500;
    
    if (isNaN(delayMs)) {
      throw new Error(`Delay inválido en frame: ${frameStr}`);
    }
    
    return { id, delay: delayMs };
  }) : [];
  
  // Si hay animated traits, se expandirán después
  // Por ahora, retornar la configuración con animated traits separados
  
  // Validar que hay al menos frames o animated
  if (normalFrames.length === 0 && animatedTraits.length === 0) {
    throw new Error('Se requiere el parámetro "frames" o "animated" (ej: frames=32:200,870:400 o animated=1167:500)');
  }
  
  return {
    method,
    base: base || null,
    fixed: fixed ? fixed.split(',').map(id => id.trim()) : [],
    frames: normalFrames,
    animatedTraits: animatedTraits,
    movements: parseMovements(move),
    gifId: gifId ? gifId.toString() : null,
    adrianZeroTokenId: adrianZeroTokenId ? adrianZeroTokenId.toString() : null
  };
}

/**
 * Cargar y extraer frames de un GIF pre-generado
 * V3: Siempre redimensiona a 400x400 para mantener consistencia
 */
async function loadGifFrames(gifId) {
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
  let originalPalette = null;
  if (gif.globalColorTable && gif.globalColorTable.length > 0) {
    originalPalette = gif.globalColorTable;
    console.log(`[loadGifFrames] Paleta original detectada: ${originalPalette.length} colores`);
  }
  
  // V3: Siempre redimensionar a 400x400
  const targetWidth = 400;
  const targetHeight = 400;
  
  // Procesar cada frame: convertir a PNG y redimensionar a 400x400
  const processedFrames = [];
  
  for (let i = 0; i < gifFrames.length; i++) {
    const frame = gifFrames[i];
    
    console.log(`[loadGifFrames] Procesando frame ${i + 1}/${gifFrames.length}`);
    
    // Convertir GifFrame a PNG buffer usando canvas
    const frameBitmap = frame.bitmap;
    
    // Crear canvas temporal para el frame
    const frameCanvas = createCanvas(frameBitmap.width, frameBitmap.height);
    const frameCtx = frameCanvas.getContext('2d');
    
    // Obtener datos de imagen del frame
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
    
    // Redimensionar a 400x400
    const finalBuffer = await sharp(pngBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparente
        kernel: 'lanczos3', // Kernel de alta calidad
        withoutEnlargement: false
      })
      .png({
        quality: 100,
        compressionLevel: 9,
        palette: false
      })
      .toBuffer();
    
    processedFrames.push({
      pngBuffer: finalBuffer,
      index: i
    });
  }
  
  console.log(`[loadGifFrames] ✅ ${processedFrames.length} frames procesados a 400x400`);
  return {
    frames: processedFrames,
    width: targetWidth,
    height: targetHeight,
    originalPalette: originalPalette
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
 * Cargar AdrianZERO renderizado por tokenId
 */
async function loadAdrianZero(tokenId) {
  console.log(`[loadAdrianZero] Cargando AdrianZERO token: ${tokenId}`);
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
  const renderUrl = `${baseUrl}/api/render/custom/${tokenId}`;
  
  console.log(`[loadAdrianZero] URL: ${renderUrl}`);
  
  try {
    const response = await fetch(renderUrl);
    if (!response.ok) {
      throw new Error(`Failed to load AdrianZERO ${tokenId}: ${response.status} ${response.statusText}`);
    }
    
    const pngBuffer = await response.arrayBuffer();
    console.log(`[loadAdrianZero] AdrianZERO ${tokenId} cargado: ${pngBuffer.byteLength} bytes`);
    
    // Redimensionar a 400x400
    const resizedBuffer = await sharp(Buffer.from(pngBuffer))
      .resize(400, 400, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparente
        kernel: 'lanczos3',
        withoutEnlargement: false
      })
      .png({
        quality: 100,
        compressionLevel: 9,
        palette: false
      })
      .toBuffer();
    
    console.log(`[loadAdrianZero] AdrianZERO ${tokenId} redimensionado a 400x400: ${resizedBuffer.length} bytes`);
    return resizedBuffer;
  } catch (error) {
    console.error(`[loadAdrianZero] Error cargando AdrianZERO ${tokenId}:`, error.message);
    throw error;
  }
}

/**
 * Generar un frame con múltiples capas y transformaciones
 * V3: GIF como background visual que se cicla
 */
async function generateLayeredFrame(baseId, fixedIds, variableId, method, movements, frameIndex, totalFrames, gifFrame = null, adrianZeroBuffer = null, width = 400, height = 400) {
  const layers = [];
  
  // 0. AdrianZERO renderizado (si existe) - va primero (más abajo de todo)
  if (adrianZeroBuffer) {
    layers.push({
      id: 'adrianzero-base',
      pngBuffer: adrianZeroBuffer,
      type: 'adrianzero',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }
    });
  }
  
  // 1. GIF Background (si existe) - va después del AdrianZERO
  if (gifFrame) {
    layers.push({
      id: 'gif-background',
      pngBuffer: gifFrame.pngBuffer,
      type: 'gif',
      transform: { x: 0, y: 0, scale: 1, rotation: 0 }
    });
  }
  
  // 2. Skin base (si existe)
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
  
  // 3. Traits fijos
  for (const fixedId of fixedIds) {
    const fixedPng = await svgToPng(fixedId, method, width);
    const fixedMovement = findMovement(movements, 'fixed', fixedId);
    const fixedTransform = calculatePosition(fixedMovement, frameIndex, totalFrames);
    
    layers.push({ 
      id: fixedId, 
      pngBuffer: fixedPng, 
      type: 'fixed',
      transform: fixedTransform
    });
  }
  
  // 4. Trait variable del frame
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
  
  // Componer todas las capas con transformaciones
  return await compositeFrameWithTransforms(layers, width, height);
}

/**
 * V3: gifwrap con SVG controlando frames y delays, GIF como background visual
 */
async function generateGifWithGifwrap(config) {
  const { base, fixed, frames, animatedTraits, movements, gifId, adrianZeroTokenId } = config;
  
  console.log(`[GIFWRAP-V3] Generando GIF con SVG controlando frames:`);
  console.log(`[GIFWRAP-V3] - Base: ${base || 'ninguna'}`);
  console.log(`[GIFWRAP-V3] - Fixed: [${fixed.join(', ') || 'ninguno'}]`);
  console.log(`[GIFWRAP-V3] - Frames SVG: ${frames.length}`);
  console.log(`[GIFWRAP-V3] - Animated Traits: ${animatedTraits.length}`);
  animatedTraits.forEach((at, i) => {
    console.log(`[GIFWRAP-V3]   Animated ${i + 1}: ${at.baseId} (${at.delay}ms)`);
  });
  console.log(`[GIFWRAP-V3] - Movimientos: ${movements.length}`);
  console.log(`[GIFWRAP-V3] - GIF Background: ${gifId || 'ninguno'} (se cicla como background)`);
  console.log(`[GIFWRAP-V3] - AdrianZERO TokenId: ${adrianZeroTokenId || 'ninguno'} (base renderizada)`);
  
  // Expandir animated traits a frames
  let expandedFrames = [...frames];
  if (animatedTraits && animatedTraits.length > 0) {
    for (const animTrait of animatedTraits) {
      const variants = await detectAnimatedVariants(animTrait.baseId);
      if (variants.length > 0) {
        console.log(`[GIFWRAP-V3] Animated trait ${animTrait.baseId}: ${variants.length} variants encontrados`);
        variants.forEach(variant => {
          expandedFrames.push({
            id: variant,
            delay: animTrait.delay
          });
        });
      } else {
        console.warn(`[GIFWRAP-V3] No se encontraron variantes para ${animTrait.baseId}`);
      }
    }
  }
  
  // Cargar AdrianZERO si existe (una sola vez, se reutiliza en todos los frames)
  let adrianZeroBuffer = null;
  if (adrianZeroTokenId) {
    adrianZeroBuffer = await loadAdrianZero(adrianZeroTokenId);
    console.log(`[GIFWRAP-V3] AdrianZERO ${adrianZeroTokenId} cargado como base`);
  }
  
  // Cargar frames del GIF si existe (solo para background visual)
  let gifFramesData = null;
  let originalGifPalette = null;
  if (gifId) {
    const gifData = await loadGifFrames(gifId);
    gifFramesData = gifData.frames;
    originalGifPalette = gifData.originalPalette;
    console.log(`[GIFWRAP-V3] GIF cargado: ${gifFramesData.length} frames (background visual)`);
    if (originalGifPalette) {
      console.log(`[GIFWRAP-V3] Paleta original preservada: ${originalGifPalette.length} colores`);
    }
  }
  
  const outputGifFrames = [];
  const totalSvgFrames = expandedFrames.length;
  
  // V3: SVG siempre controla el número total de frames
  const totalFrames = totalSvgFrames;
  const width = 400;
  const height = 400;
  
  console.log(`[GIFWRAP-V3] Total frames: ${totalFrames} (controlados por SVG, incluyendo animated traits)`);
  
  for (let i = 0; i < totalFrames; i++) {
    // V3: Ciclar GIF si es necesario (background visual)
    const gifFrameIndex = gifFramesData ? (i % gifFramesData.length) : null;
    const gifFrame = gifFramesData ? gifFramesData[gifFrameIndex] : null;
    
    // V3: Usar frame SVG correspondiente (de expandedFrames)
    const svgFrame = expandedFrames[i];
    
    console.log(`[GIFWRAP-V3] Frame ${i + 1}/${totalFrames}: SVG trait ${svgFrame.id} (${svgFrame.delay}ms), GIF background frame ${gifFrameIndex !== null ? gifFrameIndex + 1 : 'N/A'}`);
    
    // Generar frame con capas, transformaciones, AdrianZERO base y GIF background
    const compositePng = await generateLayeredFrame(
      base,
      fixed,
      svgFrame.id,
      'resvg',
      movements,
      i,
      totalFrames,
      gifFrame,
      adrianZeroBuffer,
      width,
      height
    );
    
    console.log(`[GIFWRAP-V3] Frame ${i + 1} compuesto, tamaño: ${compositePng.length} bytes`);
    
    // Convertir a GifFrame
    const pngImage = PNG.sync.read(compositePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    // V3: SIEMPRE usar el delay del SVG (SVG controla la velocidad)
    const delayMs = svgFrame.delay;
    const delayCentisecs = Math.round(delayMs / 10);
    const outputFrame = new GifFrame(bitmapImage, { delayCentisecs });
    outputGifFrames.push(outputFrame);
  }
  
  // Cuantizar colores preservando la paleta original si existe
  console.log(`[GIFWRAP-V3] Cuantizando ${outputGifFrames.length} frames...`);
  if (originalGifPalette && originalGifPalette.length > 0) {
    const paletteSize = Math.min(originalGifPalette.length, 256);
    console.log(`[GIFWRAP-V3] Usando paleta original con ${paletteSize} colores`);
    GifUtil.quantizeWu(outputGifFrames, paletteSize);
  } else {
    GifUtil.quantizeWu(outputGifFrames, 256);
  }
  
  // Generar GIF
  console.log(`[GIFWRAP-V3] Generando GIF...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(outputGifFrames, { loops: 0 });
  
  console.log(`[GIFWRAP-V3] GIF completado: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}

/**
 * V3: sharp con SVG controlando frames y delays, GIF como background visual
 */
async function generateGifWithSharp(config) {
  const { base, fixed, frames, animatedTraits, movements, gifId, adrianZeroTokenId } = config;
  const width = 400;
  const height = 400;
  
  console.log(`[SHARP-V3] Generando GIF con SVG controlando frames:`);
  console.log(`[SHARP-V3] - Base: ${base || 'ninguna'}`);
  console.log(`[SHARP-V3] - Fixed: [${fixed.join(', ') || 'ninguno'}]`);
  console.log(`[SHARP-V3] - Frames SVG: ${frames.length}`);
  console.log(`[SHARP-V3] - Animated Traits: ${animatedTraits.length}`);
  animatedTraits.forEach((at, i) => {
    console.log(`[SHARP-V3]   Animated ${i + 1}: ${at.baseId} (${at.delay}ms)`);
  });
  console.log(`[SHARP-V3] - Movimientos: ${movements.length}`);
  console.log(`[SHARP-V3] - GIF Background: ${gifId || 'ninguno'} (se cicla como background)`);
  console.log(`[SHARP-V3] - AdrianZERO TokenId: ${adrianZeroTokenId || 'ninguno'} (base renderizada)`);
  
  // Expandir animated traits a frames
  let expandedFrames = [...frames];
  if (animatedTraits && animatedTraits.length > 0) {
    for (const animTrait of animatedTraits) {
      const variants = await detectAnimatedVariants(animTrait.baseId);
      if (variants.length > 0) {
        console.log(`[SHARP-V3] Animated trait ${animTrait.baseId}: ${variants.length} variants encontrados`);
        variants.forEach(variant => {
          expandedFrames.push({
            id: variant,
            delay: animTrait.delay
          });
        });
      } else {
        console.warn(`[SHARP-V3] No se encontraron variantes para ${animTrait.baseId}`);
      }
    }
  }
  
  // Cargar AdrianZERO si existe (una sola vez, se reutiliza en todos los frames)
  let adrianZeroBuffer = null;
  if (adrianZeroTokenId) {
    adrianZeroBuffer = await loadAdrianZero(adrianZeroTokenId);
    console.log(`[SHARP-V3] AdrianZERO ${adrianZeroTokenId} cargado como base`);
  }
  
  // Cargar frames del GIF si existe (solo para background visual)
  let gifFramesData = null;
  if (gifId) {
    const gifData = await loadGifFrames(gifId);
    gifFramesData = gifData.frames;
    console.log(`[SHARP-V3] GIF cargado: ${gifFramesData.length} frames (background visual)`);
  }
  
  // Inicializar encoder
  const encoder = new GifEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(10);
  
  // V3: SVG siempre controla el número total de frames
  const totalFrames = expandedFrames.length;
  
  console.log(`[SHARP-V3] Total frames: ${totalFrames} (controlados por SVG, incluyendo animated traits)`);
  
  for (let i = 0; i < totalFrames; i++) {
    // V3: Ciclar GIF si es necesario (background visual)
    const gifFrameIndex = gifFramesData ? (i % gifFramesData.length) : null;
    const gifFrame = gifFramesData ? gifFramesData[gifFrameIndex] : null;
    
    // V3: Usar frame SVG correspondiente
    const svgFrame = expandedFrames[i];
    
    console.log(`[SHARP-V3] Frame ${i + 1}/${totalFrames}: SVG trait ${svgFrame.id} (${svgFrame.delay}ms), GIF background frame ${gifFrameIndex !== null ? gifFrameIndex + 1 : 'N/A'}`);
    
    // V3: SIEMPRE usar el delay del SVG (SVG controla la velocidad)
    const delayMs = svgFrame.delay;
    encoder.setDelay(delayMs);
    
    // Generar frame con capas, transformaciones, AdrianZERO base y GIF background
    const compositePng = await generateLayeredFrame(
      base,
      fixed,
      svgFrame.id,
      'sharp',
      movements,
      i,
      totalFrames,
      gifFrame,
      adrianZeroBuffer,
      width,
      height
    );
    
    console.log(`[SHARP-V3] Frame ${i + 1} compuesto, tamaño: ${compositePng.length} bytes`);
    
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
  
  console.log(`[SHARP-V3] GIF completado: ${gifBuffer.length} bytes`);
  return gifBuffer;
}

/**
 * Handler principal V3
 */
export default async function handler(req, res) {
  const startTime = Date.now();
  
  try {
    // Parsear parámetros
    const config = parseQueryParams(req.query);
    
    // Expandir animated traits a frames antes de validar
    let totalFrames = config.frames.length;
    if (config.animatedTraits && config.animatedTraits.length > 0) {
      for (const animTrait of config.animatedTraits) {
        const variants = await detectAnimatedVariants(animTrait.baseId);
        totalFrames += variants.length;
      }
    }
    
    // Validaciones
    if (totalFrames < 1) {
      return res.status(400).json({ 
        error: 'Se requiere al menos 1 frame',
        example: '/api/test-gif-simple-v3?frames=32:200,870:400 o animated=1167:500'
      });
    }
    
    if (totalFrames > 20) {
      return res.status(400).json({ 
        error: 'Máximo 20 frames permitidos',
        received: totalFrames
      });
    }
    
    // Validar delays de frames normales
    for (const frame of config.frames) {
      if (frame.delay < 10 || frame.delay > 5000) {
        return res.status(400).json({ 
          error: `Delay debe estar entre 10 y 5000 ms (frame: ${frame.id})`,
          received: frame.delay
        });
      }
    }
    
    // Validar delays de animated traits
    for (const animTrait of config.animatedTraits) {
      if (animTrait.delay < 10 || animTrait.delay > 5000) {
        return res.status(400).json({ 
          error: `Delay debe estar entre 10 y 5000 ms (animated: ${animTrait.baseId})`,
          received: animTrait.delay
        });
      }
    }
    
    console.log(`[test-gif-simple-v3] ========================================`);
    console.log(`[test-gif-simple-v3] V3: SVG controla frames y delays, GIF como background`);
    console.log(`[test-gif-simple-v3] - Método: ${config.method}`);
    console.log(`[test-gif-simple-v3] - Base: ${config.base || 'ninguna'}`);
    console.log(`[test-gif-simple-v3] - Fixed: [${config.fixed.join(', ') || 'ninguno'}]`);
    console.log(`[test-gif-simple-v3] - GIF Background: ${config.gifId || 'ninguno'} (se cicla)`);
    console.log(`[test-gif-simple-v3] - AdrianZERO TokenId: ${config.adrianZeroTokenId || 'ninguno'} (base renderizada)`);
    console.log(`[test-gif-simple-v3] - Frames SVG: ${config.frames.length}`);
    config.frames.forEach((f, i) => {
      console.log(`[test-gif-simple-v3]   Frame ${i + 1}: ${f.id} (${f.delay}ms)`);
    });
    console.log(`[test-gif-simple-v3] - Animated Traits: ${config.animatedTraits.length}`);
    config.animatedTraits.forEach((at, i) => {
      console.log(`[test-gif-simple-v3]   Animated ${i + 1}: ${at.baseId} (${at.delay}ms)`);
    });
    console.log(`[test-gif-simple-v3] - Movimientos: ${config.movements.length}`);
    config.movements.forEach((m, i) => {
      const layerSpec = m.layerId ? `${m.layerType}.${m.layerId}` : m.layerType;
      console.log(`[test-gif-simple-v3]   Movimiento ${i + 1}: ${layerSpec} - ${m.type} (${m.params.join(', ')})`);
    });
    console.log(`[test-gif-simple-v3] ========================================`);
    
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
    
    console.log(`[test-gif-simple-v3] ========================================`);
    console.log(`[test-gif-simple-v3] ✅ GIF generado exitosamente`);
    console.log(`[test-gif-simple-v3] - Método: ${config.method}`);
    console.log(`[test-gif-simple-v3] - Duración: ${duration}ms`);
    console.log(`[test-gif-simple-v3] - Tamaño: ${(gifBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`[test-gif-simple-v3] - Frames: ${config.frames.length}`);
    console.log(`[test-gif-simple-v3] - Capas por frame: ${totalLayers}`);
    console.log(`[test-gif-simple-v3] - Delay promedio: ${avgDelay.toFixed(0)}ms`);
    console.log(`[test-gif-simple-v3] ========================================`);
    
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
    res.setHeader('X-Version', '3.0');
    res.setHeader('X-Phase', '3.0');
    res.setHeader('X-Movements-Count', config.movements.length.toString());
    res.setHeader('X-Gif-Background', config.gifId || 'none');
    res.setHeader('X-AdrianZero-TokenId', config.adrianZeroTokenId || 'none');
    res.setHeader('X-Approach', 'SVG-controls-frames-delays');
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[test-gif-simple-v3] ❌ ERROR:', error);
    console.error('[test-gif-simple-v3] Stack:', error.stack);
    console.error(`[test-gif-simple-v3] Duración hasta error: ${duration}ms`);
    
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      duration: `${duration}ms`,
      version: '3.0',
      phase: 3
    });
  }
}


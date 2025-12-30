import { Resvg } from '@resvg/resvg-js';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import GifEncoder from 'gif-encoder-2';
import { createCanvas, loadImage } from 'canvas';

/**
 * FASE 1: Endpoint avanzado con skins base, traits fijos y delays personalizados
 * 
 * Parámetros:
 * - method: 'gifwrap' | 'sharp' (default: gifwrap)
 * - base: ID del skin base (ej: adriangf, alien, darkadrian)
 * - fixed: IDs de traits fijos separados por coma (ej: 1028,662)
 * - frames: trait:delay separados por coma (ej: 32:200,870:400,14:300)
 * - svgs, delay: formato antiguo para compatibilidad
 */

// Mapa de skins especiales y sus rutas
const SPECIAL_SKINS = {
  'adriangf': '/traits/ADRIANGF/GF1/GF1-Fair.svg',
  'adriangf-fair': '/traits/ADRIANGF/GF1/GF1-Fair.svg',
  'adriangf-tan': '/traits/ADRIANGF/GF1/GF1-Tan.svg',
  'adriangf-albino': '/traits/ADRIANGF/GF1/GEN1_Albino.svg',
  'darkadrian': '/traits/ADRIAN/DARKADRIAN.svg',
  'alien': '/traits/ADRIAN/ALIEN.svg',
  'blankmannequin': '/labimages/blankmannequin.svg',
  'mannequin': '/labimages/mannequin.svg'
};

/**
 * Parsear parámetros del query
 */
function parseQueryParams(query) {
  const { method = 'gifwrap', base, fixed, frames, svgs, delay } = query;
  
  // Soporte para formato antiguo (compatibilidad hacia atrás)
  if (svgs && delay) {
    return {
      method,
      base: null,
      fixed: [],
      frames: svgs.split(',').map(id => ({ 
        id: id.trim(), 
        delay: parseInt(delay) 
      }))
    };
  }
  
  // Nuevo formato con delays individuales
  if (!frames) {
    throw new Error('Se requiere el parámetro "frames" (ej: frames=32:200,870:400)');
  }
  
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
    })
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
 * Componer múltiples capas PNG en un solo canvas
 */
async function compositeFrame(layers, width = 400, height = 400) {
  console.log(`[compositeFrame] Componiendo ${layers.length} capas`);
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  // Dibujar cada capa en orden
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    console.log(`[compositeFrame] Dibujando capa ${i + 1}/${layers.length}: ${layer.id} (${layer.type})`);
    
    const img = await loadImage(layer.pngBuffer);
    ctx.drawImage(img, 0, 0, width, height);
  }
  
  return canvas.toBuffer('image/png');
}

/**
 * Generar un frame con múltiples capas
 */
async function generateLayeredFrame(baseId, fixedIds, variableId, method) {
  const layers = [];
  
  // 1. Skin base (si existe)
  if (baseId) {
    const basePng = await svgToPng(baseId, method);
    layers.push({ 
      id: baseId, 
      pngBuffer: basePng, 
      type: 'base' 
    });
  }
  
  // 2. Traits fijos
  for (const fixedId of fixedIds) {
    const fixedPng = await svgToPng(fixedId, method);
    layers.push({ 
      id: fixedId, 
      pngBuffer: fixedPng, 
      type: 'fixed' 
    });
  }
  
  // 3. Trait variable del frame
  if (variableId) {
    const variablePng = await svgToPng(variableId, method);
    layers.push({ 
      id: variableId, 
      pngBuffer: variablePng, 
      type: 'variable' 
    });
  }
  
  // Componer todas las capas
  return await compositeFrame(layers);
}

/**
 * Enfoque A: gifwrap con sistema de capas
 */
async function generateGifWithGifwrap(config) {
  const { base, fixed, frames } = config;
  
  console.log(`[GIFWRAP] Generando GIF con capas:`);
  console.log(`[GIFWRAP] - Base: ${base || 'ninguna'}`);
  console.log(`[GIFWRAP] - Fixed: [${fixed.join(', ') || 'ninguno'}]`);
  console.log(`[GIFWRAP] - Frames: ${frames.length}`);
  
  const gifFrames = [];
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    console.log(`[GIFWRAP] Frame ${i + 1}/${frames.length}: ${frame.id} (${frame.delay}ms)`);
    
    // Generar frame con capas
    const compositePng = await generateLayeredFrame(
      base,
      fixed,
      frame.id,
      'resvg'
    );
    
    console.log(`[GIFWRAP] Frame ${i + 1} compuesto, tamaño: ${compositePng.length} bytes`);
    
    // Convertir a GifFrame
    const pngImage = PNG.sync.read(compositePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    const delayCentisecs = Math.round(frame.delay / 10);
    const gifFrame = new GifFrame(bitmapImage, { delayCentisecs });
    gifFrames.push(gifFrame);
  }
  
  // Cuantizar colores a 256
  console.log(`[GIFWRAP] Cuantizando ${gifFrames.length} frames...`);
  GifUtil.quantizeWu(gifFrames, 256);
  
  // Generar GIF
  console.log(`[GIFWRAP] Generando GIF...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(gifFrames, { loops: 0 });
  
  console.log(`[GIFWRAP] GIF completado: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}

/**
 * Enfoque B: sharp + gif-encoder-2 con sistema de capas
 */
async function generateGifWithSharp(config) {
  const { base, fixed, frames } = config;
  const width = 400;
  const height = 400;
  
  console.log(`[SHARP] Generando GIF con capas:`);
  console.log(`[SHARP] - Base: ${base || 'ninguna'}`);
  console.log(`[SHARP] - Fixed: [${fixed.join(', ') || 'ninguno'}]`);
  console.log(`[SHARP] - Frames: ${frames.length}`);
  
  // Inicializar encoder
  const encoder = new GifEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(10);
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    console.log(`[SHARP] Frame ${i + 1}/${frames.length}: ${frame.id} (${frame.delay}ms)`);
    
    // Configurar delay específico para este frame
    encoder.setDelay(frame.delay);
    
    // Generar frame con capas
    const compositePng = await generateLayeredFrame(
      base,
      fixed,
      frame.id,
      'sharp'
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
 * Handler principal
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
        example: '/api/test-gif-simple?frames=32:200,870:400'
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
    
    console.log(`[test-gif-simple] ========================================`);
    console.log(`[test-gif-simple] FASE 1: Request con capas`);
    console.log(`[test-gif-simple] - Método: ${config.method}`);
    console.log(`[test-gif-simple] - Base: ${config.base || 'ninguna'}`);
    console.log(`[test-gif-simple] - Fixed: [${config.fixed.join(', ') || 'ninguno'}]`);
    console.log(`[test-gif-simple] - Frames: ${config.frames.length}`);
    config.frames.forEach((f, i) => {
      console.log(`[test-gif-simple]   Frame ${i + 1}: ${f.id} (${f.delay}ms)`);
    });
    console.log(`[test-gif-simple] ========================================`);
    
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
    
    console.log(`[test-gif-simple] ========================================`);
    console.log(`[test-gif-simple] ✅ GIF generado exitosamente`);
    console.log(`[test-gif-simple] - Método: ${config.method}`);
    console.log(`[test-gif-simple] - Duración: ${duration}ms`);
    console.log(`[test-gif-simple] - Tamaño: ${(gifBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`[test-gif-simple] - Frames: ${config.frames.length}`);
    console.log(`[test-gif-simple] - Capas por frame: ${totalLayers}`);
    console.log(`[test-gif-simple] - Delay promedio: ${avgDelay.toFixed(0)}ms`);
    console.log(`[test-gif-simple] ========================================`);
    
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
    res.setHeader('X-Phase', '1');
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('[test-gif-simple] ❌ ERROR:', error);
    console.error('[test-gif-simple] Stack:', error.stack);
    console.error(`[test-gif-simple] Duración hasta error: ${duration}ms`);
    
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      duration: `${duration}ms`,
      phase: 1
    });
  }
}

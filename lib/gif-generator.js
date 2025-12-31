/**
 * Generador de GIFs animados desde capas
 * Extraído y adaptado de test-gif-simple-v3.js
 */

import { Resvg } from '@resvg/resvg-js';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import { detectAnimatedVariants } from './animated-traits-helper.js';

const DEFAULT_DELAY = 500; // 500ms por defecto
const DEFAULT_WIDTH = 1000; // Tamaño por defecto para AdrianZERO
const DEFAULT_HEIGHT = 1000;

/**
 * Convertir SVG a PNG buffer
 */
async function svgToPngBuffer(svgUrl, width = DEFAULT_WIDTH) {
  try {
    const response = await fetch(svgUrl);
    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.status}`);
    }
    
    const svgContent = await response.text();
    const resvg = new Resvg(Buffer.from(svgContent), {
      fitTo: { mode: 'width', value: width },
      background: 'rgba(255, 255, 255, 0)' // Transparente
    });
    
    return resvg.render().asPng();
  } catch (error) {
    console.error(`[gif-generator] Error convirtiendo SVG a PNG: ${error.message}`);
    throw error;
  }
}

/**
 * Componer múltiples capas PNG en un solo canvas
 */
async function compositeLayers(layers, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Canvas transparente por defecto (no rellenar fondo)
  
  // Dibujar cada capa en orden
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    
    if (!layer.pngBuffer) {
      console.warn(`[gif-generator] Capa ${i + 1} sin pngBuffer, saltando`);
      continue;
    }
    
    try {
      const img = await loadImage(layer.pngBuffer);
      ctx.drawImage(img, 0, 0, width, height);
    } catch (error) {
      console.error(`[gif-generator] Error dibujando capa ${i + 1}: ${error.message}`);
    }
  }
  
  return canvas.toBuffer('image/png');
}

/**
 * Generar GIF desde capas con traits animados
 * @param {Object} config - Configuración del GIF
 * @param {Array} config.stableLayers - Capas que aparecen en todos los frames (base, skin, traits no animados)
 * @param {Array} config.animatedTraits - Array de traits animados con sus variantes
 * @param {number} config.width - Ancho del GIF (default: 1000)
 * @param {number} config.height - Alto del GIF (default: 1000)
 * @param {number} config.delay - Delay por frame en ms (default: 500)
 * @returns {Promise<Buffer>} Buffer del GIF generado
 */
export async function generateGifFromLayers(config) {
  const {
    stableLayers = [],
    animatedTraits = [],
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    delay = DEFAULT_DELAY
  } = config;
  
  console.log(`[gif-generator] Generando GIF desde capas:`);
  console.log(`[gif-generator] - Capas estables: ${stableLayers.length}`);
  console.log(`[gif-generator] - Traits animados: ${animatedTraits.length}`);
  console.log(`[gif-generator] - Tamaño: ${width}x${height}`);
  console.log(`[gif-generator] - Delay: ${delay}ms`);
  
  // Si no hay traits animados, no generar GIF
  if (animatedTraits.length === 0) {
    throw new Error('No hay traits animados para generar GIF');
  }
  
  // Expandir traits animados a variantes
  const expandedFrames = [];
  let maxVariants = 0;
  
  for (const animTrait of animatedTraits) {
    const variants = animTrait.variants || await detectAnimatedVariants(animTrait.baseId);
    
    if (variants.length > 0) {
      console.log(`[gif-generator] Trait ${animTrait.baseId}: ${variants.length} variantes`);
      maxVariants = Math.max(maxVariants, variants.length);
      
      // Añadir variantes a frames
      for (let i = 0; i < variants.length; i++) {
        if (!expandedFrames[i]) {
          expandedFrames[i] = [];
        }
        expandedFrames[i].push({
          traitId: variants[i],
          category: animTrait.category,
          baseId: animTrait.baseId
        });
      }
    }
  }
  
  // Si hay múltiples traits animados con diferente número de variantes,
  // usar el máximo y repetir la última variante para los que tienen menos
  const totalFrames = maxVariants;
  
  console.log(`[gif-generator] Total frames: ${totalFrames}`);
  
  // Generar frames del GIF
  const outputGifFrames = [];
  
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    console.log(`[gif-generator] Generando frame ${frameIndex + 1}/${totalFrames}`);
    
    // Construir capas para este frame
    const frameLayers = [];
    
    // 1. Añadir capas estables (base, skin, traits no animados)
    for (const stableLayer of stableLayers) {
      frameLayers.push({
        pngBuffer: stableLayer.pngBuffer
      });
    }
    
    // 2. Añadir variantes de traits animados para este frame
    for (const animTrait of animatedTraits) {
      const variants = animTrait.variants || [];
      const variantIndex = Math.min(frameIndex, variants.length - 1); // Repetir última si hay menos variantes
      const variantId = variants[variantIndex];
      
      if (variantId) {
        // Cargar variante como PNG
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const svgUrl = `${baseUrl}/labimages/${variantId}.svg`;
        
        try {
          const variantPng = await svgToPngBuffer(svgUrl, width);
          frameLayers.push({
            pngBuffer: variantPng
          });
        } catch (error) {
          console.error(`[gif-generator] Error cargando variante ${variantId}: ${error.message}`);
        }
      }
    }
    
    // 3. Componer todas las capas en un frame
    const compositePng = await compositeLayers(frameLayers, width, height);
    
    // 4. Convertir PNG a GifFrame
    const pngImage = PNG.sync.read(compositePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    const delayCentisecs = Math.round(delay / 10);
    const outputFrame = new GifFrame(bitmapImage, { delayCentisecs });
    outputGifFrames.push(outputFrame);
  }
  
  // Cuantizar colores
  console.log(`[gif-generator] Cuantizando ${outputGifFrames.length} frames...`);
  GifUtil.quantizeWu(outputGifFrames, 256);
  
  // Generar GIF
  console.log(`[gif-generator] Generando GIF...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(outputGifFrames, { loops: 0 });
  
  console.log(`[gif-generator] GIF completado: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}

/**
 * Generar GIF para Floppy (trait individual)
 * @param {Object} config - Configuración del GIF
 * @param {Buffer} config.mannequinBuffer - Buffer PNG del mannequin (capa estable)
 * @param {Array} config.animatedTraits - Array con un solo trait animado
 * @param {number} config.width - Ancho del GIF (default: 600 para floppy)
 * @param {number} config.height - Alto del GIF (default: 600 para floppy)
 * @param {number} config.delay - Delay por frame en ms (default: 500)
 * @returns {Promise<Buffer>} Buffer del GIF generado
 */
export async function generateFloppyGif(config) {
  const {
    mannequinBuffer,
    animatedTraits = [],
    width = 600,
    height = 600,
    delay = DEFAULT_DELAY
  } = config;
  
  if (animatedTraits.length === 0) {
    throw new Error('No hay trait animado para generar GIF de floppy');
  }
  
  const animTrait = animatedTraits[0]; // Floppy solo tiene un trait
  const variants = animTrait.variants || await detectAnimatedVariants(animTrait.baseId);
  
  if (variants.length === 0) {
    throw new Error(`No se encontraron variantes para trait ${animTrait.baseId}`);
  }
  
  console.log(`[gif-generator] Generando GIF Floppy para trait ${animTrait.baseId}: ${variants.length} variantes`);
  
  const outputGifFrames = [];
  
  for (let frameIndex = 0; frameIndex < variants.length; frameIndex++) {
    const variantId = variants[frameIndex];
    console.log(`[gif-generator] Frame ${frameIndex + 1}/${variants.length}: ${variantId}`);
    
    // Construir capas para este frame
    const frameLayers = [];
    
    // 1. Mannequin (estable)
    if (mannequinBuffer) {
      frameLayers.push({ pngBuffer: mannequinBuffer });
    }
    
    // 2. Variante del trait animado
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const svgUrl = `${baseUrl}/labimages/${variantId}.svg`;
    
    try {
      const variantPng = await svgToPngBuffer(svgUrl, width);
      frameLayers.push({ pngBuffer: variantPng });
    } catch (error) {
      console.error(`[gif-generator] Error cargando variante ${variantId}: ${error.message}`);
      continue;
    }
    
    // 3. Componer capas
    const compositePng = await compositeLayers(frameLayers, width, height);
    
    // 4. Convertir a GifFrame
    const pngImage = PNG.sync.read(compositePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    const delayCentisecs = Math.round(delay / 10);
    const outputFrame = new GifFrame(bitmapImage, { delayCentisecs });
    outputGifFrames.push(outputFrame);
  }
  
  // Cuantizar colores
  console.log(`[gif-generator] Cuantizando ${outputGifFrames.length} frames...`);
  GifUtil.quantizeWu(outputGifFrames, 256);
  
  // Generar GIF
  console.log(`[gif-generator] Generando GIF Floppy...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(outputGifFrames, { loops: 0 });
  
  console.log(`[gif-generator] GIF Floppy completado: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}


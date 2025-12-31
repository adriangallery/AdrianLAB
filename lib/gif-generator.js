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
 * Generar GIF para Floppy (trait individual) con todos los elementos fijos
 * @param {Object} config - Configuración del GIF
 * @param {string|number} config.traitId - ID del trait animado
 * @param {object} config.tokenData - Metadata del token (name, category, floppy, maxSupply)
 * @param {number} config.totalMinted - Total de tokens minteados
 * @param {object} config.rarity - Objeto con { tag, bg } para la rareza
 * @param {number} [config.width=768] - Ancho del GIF (768 para floppy completo)
 * @param {number} [config.height=1024] - Alto del GIF (1024 para floppy completo)
 * @param {number} [config.delay=500] - Delay por frame en ms
 * @returns {Promise<Buffer>} Buffer del GIF generado
 */
export async function generateFloppyGif(config) {
  const {
    traitId,
    tokenData,
    totalMinted,
    rarity,
    width = 768,
    height = 1024,
    delay = DEFAULT_DELAY
  } = config;

  console.log(`[gif-generator] Iniciando generateFloppyGif para trait ${traitId}`);

  const animatedTraitsConfig = await getAnimatedTraits([traitId]);

  if (animatedTraitsConfig.length === 0) {
    throw new Error(`Trait ${traitId} no es un trait animado o no tiene variantes.`);
  }

  const animTrait = animatedTraitsConfig[0];
  const outputGifFrames = [];
  const totalFrames = animTrait.variants.length;

  console.log(`[gif-generator] Floppy Animated Trait ${traitId}: ${totalFrames} frames, delay ${animTrait.delay}ms`);

  // Importar funciones de texto a SVG
  const { textToSVGElement, linesToSVG } = await import('./text-to-svg.js');

  // Cargar frame SVG una sola vez
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
  const frameUrl = `${baseUrl}/labimages/frameimproved.svg`;
  let frameInline = '';
  try {
    const frameResp = await fetch(frameUrl);
    if (frameResp.ok) {
      let frameSvg = await frameResp.text();
      frameSvg = frameSvg
        .replace(/<\?xml[^>]*\?>/, '')
        .replace(/<svg[^>]*>/, '')
        .replace(/<\/svg>/, '');
      frameInline = frameSvg;
    }
  } catch (e) {
    console.warn(`[gif-generator] Error cargando frame: ${e.message}`);
  }

  // Cargar mannequin una sola vez como data URL
  const mannequinImageData = await svgToDataUrl('mannequin', 600);

  for (let i = 0; i < totalFrames; i++) {
    const currentVariantId = animTrait.variants[i];
    console.log(`[gif-generator] Frame ${i + 1}/${totalFrames}: ${currentVariantId}`);

    // Cargar variante del trait como data URL
    const traitImageData = await svgToDataUrl(currentVariantId, 600);

    // Generar SVG completo para este frame (igual que el render estático)
    const frameSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <!-- Capa base en gris claro (bajo todos los elementos) -->
        <rect width="${width}" height="${height}" fill="#f5f5f5"/>
        
        <!-- Frame SVG (fondo de todas las capas) -->
        <g transform="translate(0, 0)">
          ${frameInline}
        </g>
        
        <!-- Contenedor de imagen con fondo dinámico -->
        <rect x="84" y="120" width="600" height="600" fill="${rarity.bg}20"/>
        
        <!-- Mannequin (base del personaje) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${mannequinImageData}" />
        
        <!-- Imagen del trait (centrada en el contenedor) usando <image> -->
        <image x="84" y="120" width="600" height="600" href="${traitImageData}" />
        
        <!-- Tag de rareza (superior izquierda) - convertido a path -->
        <rect x="84" y="120" width="160" height="60" fill="${rarity.bg}"/>
        ${textToSVGElement(rarity.tag, {
          x: 84 + 160 / 2,
          y: 120 + 60 / 2,
          fontSize: 32,
          fill: '#ffffff',
          anchor: 'center middle'
        })}
        
        <!-- Nombre del trait (debajo de la imagen) - convertido a path -->
        <rect x="84" y="760" width="600" height="80" fill="#0f4e6d"/>
        ${textToSVGElement(tokenData.name, {
          x: 84 + 600 / 2,
          y: 760 + 80 / 2,
          fontSize: 70,
          fill: '#ffffff',
          anchor: 'center middle'
        })}
        
        <!-- Bloque inferior de datos - convertido a paths -->
        ${linesToSVG([
          {
            text: `CATEGORY: ${tokenData.category}`,
            x: 84 + 10,
            y: 880,
            fontSize: 32,
            fill: '#333333',
            anchor: 'start middle'
          },
          {
            text: `TOTAL MINTED: ${totalMinted}`,
            x: 84 + 10,
            y: 915,
            fontSize: 32,
            fill: '#333333',
            anchor: 'start middle'
          },
          {
            text: `FLOPPY: ${tokenData.floppy || 'OG'}`,
            x: 84 + 10,
            y: 950,
            fontSize: 32,
            fill: '#333333',
            anchor: 'start middle'
          }
        ])}
        
        <!-- Logo AdrianLAB (alineado a la derecha) - convertido a paths -->
        ${textToSVGElement('Adrian', {
          x: 684 - 143,
          y: 922,
          fontSize: 56,
          fill: '#333333',
          anchor: 'end'
        })}
        
        ${textToSVGElement('LAB', {
          x: 684 - 143,
          y: 957,
          fontSize: 56,
          fill: '#ff69b4',
          anchor: 'end'
        })}
      </svg>
    `;

    // Convertir SVG a PNG
    const resvg = new Resvg(Buffer.from(frameSvg), {
      fitTo: { mode: 'width', value: width }
    });
    const framePng = resvg.render().asPng();

    // Convertir PNG a GifFrame
    const pngImage = PNG.sync.read(framePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });

    const delayCentisecs = Math.round(animTrait.delay / 10);
    const outputFrame = new GifFrame(bitmapImage, { delayCentisecs });
    outputGifFrames.push(outputFrame);
  }

  if (outputGifFrames.length === 0) {
    throw new Error('No frames generated for Floppy GIF.');
  }

  console.log(`[gif-generator] Cuantizando ${outputGifFrames.length} frames para Floppy GIF...`);
  GifUtil.quantizeWu(outputGifFrames, 256);

  console.log(`[gif-generator] Generando Floppy GIF...`);
  const codec = new GifCodec();
  const outputGif = await codec.encodeGif(outputGifFrames, { loops: 0 });

  console.log(`[gif-generator] Floppy GIF completado: ${outputGif.buffer.length} bytes`);
  return outputGif.buffer;
}

/**
 * Convierte un SVG a data URL (base64) para usar en <image> dentro de SVG
 */
async function svgToDataUrl(svgId, width = 600) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
  let url;
  
  if (svgId === 'mannequin') {
    url = `${baseUrl}/labimages/mannequin.svg`;
  } else {
    url = `${baseUrl}/labimages/${svgId}.svg`;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load SVG ${svgId}: ${response.status}`);
  }
  
  const svgBuffer = await response.arrayBuffer();
  const resvg = new Resvg(Buffer.from(svgBuffer), {
    fitTo: { mode: 'width', value: width }
  });
  const pngBuffer = resvg.render().asPng();
  
  // Convertir PNG buffer a data URL
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}


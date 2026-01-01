/**
 * Generador de GIFs animados desde capas
 * Extraído y adaptado de test-gif-simple-v3.js
 */

import { Resvg } from '@resvg/resvg-js';
import { GifFrame, BitmapImage, GifCodec, GifUtil } from 'gifwrap';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { createCanvas, loadImage } from 'canvas';
import { detectAnimatedVariants, getAnimatedTraits } from './animated-traits-helper.js';
import { getCachedSvgPng, setCachedSvgPng } from './svg-png-cache.js';

const DEFAULT_DELAY = 500; // 500ms por defecto
const DEFAULT_WIDTH = 1000; // Tamaño por defecto para AdrianZERO
const DEFAULT_HEIGHT = 1000;
const MAX_FRAMES_LCM = 15; // Límite máximo para usar MCM (sincronización perfecta)

/**
 * Calcular Máximo Común Divisor (GCD)
 */
function calculateGCD(a, b) {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Calcular Mínimo Común Múltiplo (LCM) de un array de números
 */
function calculateLCM(numbers) {
  if (numbers.length === 0) return 1;
  if (numbers.length === 1) return numbers[0];
  
  let lcm = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    lcm = (lcm * numbers[i]) / calculateGCD(lcm, numbers[i]);
  }
  return lcm;
}

/**
 * Convertir SVG a PNG buffer con caché (Fase 4.1)
 */
async function svgToPngBuffer(svgUrl, width = DEFAULT_WIDTH) {
  try {
    // Cargar contenido SVG
    const response = await fetch(svgUrl);
    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.status}`);
    }
    
    const svgContent = await response.text();
    
    // Fase 4.1: Verificar caché usando contenido SVG como clave
    const cachedPng = getCachedSvgPng(svgContent);
    if (cachedPng) {
      console.log(`[gif-generator] 🎯 CACHE HIT: Variante ${svgUrl} (${cachedPng.length} bytes)`);
      return cachedPng;
    }
    
    // Si no está en caché, convertir y guardar
    const resvg = new Resvg(Buffer.from(svgContent), {
      fitTo: { mode: 'width', value: width },
      background: 'rgba(255, 255, 255, 0)' // Transparente
    });
    
    const pngBuffer = resvg.render().asPng();
    
    // Guardar en caché
    setCachedSvgPng(svgContent, pngBuffer);
    console.log(`[gif-generator] 💾 CACHE MISS: Variante ${svgUrl} convertida y cacheada (${pngBuffer.length} bytes)`);
    
    return pngBuffer;
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
 * @param {number} config.delay - Delay por frame en ms (default: 500) - usado si frameDelays no está presente
 * @param {Array} config.frameDelays - Array opcional de delays por frame [delay1, delay2, ...] (sobrescribe delay)
 * @param {Array} config.variableFrames - Array opcional de frames variables [{ id, delay }, ...] además de animated traits
 * @param {Function} config.customFrameGenerator - Función opcional para generar frames personalizados (frameIndex, totalFrames) => { pngBuffer, delay }
 * @returns {Promise<Buffer>} Buffer del GIF generado
 */
export async function generateGifFromLayers(config) {
  const {
    stableLayers = [],
    animatedTraits = [],
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    delay = DEFAULT_DELAY,
    frameDelays = null,
    variableFrames = [],
    customFrameGenerator = null
  } = config;
  
  console.log(`[gif-generator] Generando GIF desde capas:`);
  console.log(`[gif-generator] - Capas estables: ${stableLayers.length}`);
  console.log(`[gif-generator] - Traits animados: ${animatedTraits.length}`);
  console.log(`[gif-generator] - Tamaño: ${width}x${height}`);
  console.log(`[gif-generator] - Delay: ${delay}ms`);
  
  // Si no hay traits animados ni customFrameGenerator, no generar GIF
  if (animatedTraits.length === 0 && !customFrameGenerator) {
    throw new Error('No hay traits animados ni customFrameGenerator para generar GIF');
  }
  
  // Obtener número de variantes de cada trait animado
  const variantCounts = [];
  let maxVariants = 0;
  
  for (const animTrait of animatedTraits) {
    const variants = animTrait.variants || await detectAnimatedVariants(animTrait.baseId);
    
    if (variants.length > 0) {
      console.log(`[gif-generator] Trait ${animTrait.baseId}: ${variants.length} variantes`);
      variantCounts.push(variants.length);
      maxVariants = Math.max(maxVariants, variants.length);
    }
  }
  
  // Calcular total de frames
  let totalFrames;
  let syncMode = 'none';
  
  // Si hay customFrameGenerator, usarlo para determinar totalFrames
  if (customFrameGenerator) {
    // El customFrameGenerator debe proporcionar el total de frames
    // Por ahora, asumimos que se pasa en config.totalFrames
    totalFrames = config.totalFrames || variableFrames.length || 1;
    syncMode = 'custom';
    console.log(`[gif-generator] Usando customFrameGenerator: ${totalFrames} frames`);
  } else if (variantCounts.length === 0) {
    throw new Error('No se encontraron variantes para los traits animados');
  } else if (variantCounts.length === 1) {
    // Un solo trait: usar su número de variantes
    totalFrames = variantCounts[0];
    syncMode = 'single';
    console.log(`[gif-generator] Un solo trait animado: ${totalFrames} frames`);
  } else {
    // Múltiples traits: calcular MCM
    const lcm = calculateLCM(variantCounts);
    
    if (lcm <= MAX_FRAMES_LCM) {
      // Usar MCM: sincronización perfecta
      totalFrames = lcm;
      syncMode = 'perfect';
      console.log(`[gif-generator] ✅ MCM (${lcm}) ≤ ${MAX_FRAMES_LCM}: usando ${totalFrames} frames (sincronización perfecta)`);
      console.log(`[gif-generator]   Cada trait completará ciclos enteros:`);
      variantCounts.forEach((count, i) => {
        const cycles = lcm / count;
        console.log(`[gif-generator]   - Trait ${animatedTraits[i].baseId}: ${count} variantes → ${cycles} ciclos completos`);
      });
    } else {
      // Fallback: usar máximo y ciclar
      totalFrames = maxVariants;
      syncMode = 'cycled';
      console.log(`[gif-generator] ⚠️ MCM (${lcm}) > ${MAX_FRAMES_LCM}: usando máximo ${totalFrames} frames (con ciclos)`);
      console.log(`[gif-generator]   Los traits ciclarán independientemente usando módulo`);
    }
  }
  
  console.log(`[gif-generator] Total frames: ${totalFrames} (modo: ${syncMode})`);
  
  // Fase 4.2: Pre-carga de variantes en paralelo (antes del loop de frames)
  const variantCache = new Map();
  if (animatedTraits.length > 0 && !customFrameGenerator) {
    console.log(`[gif-generator] 🚀 Pre-cargando variantes en paralelo...`);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    
    const loadPromises = [];
    for (const animTrait of animatedTraits) {
      const variants = animTrait.variants || [];
      for (const variantId of variants) {
        if (variantId && !variantCache.has(variantId)) {
          const svgUrl = `${baseUrl}/labimages/${variantId}.svg`;
          loadPromises.push(
            svgToPngBuffer(svgUrl, width)
              .then(png => {
                variantCache.set(variantId, png);
                console.log(`[gif-generator] ✅ Variante ${variantId} pre-cargada (${png.length} bytes)`);
              })
              .catch(error => {
                console.error(`[gif-generator] ❌ Error pre-cargando variante ${variantId}: ${error.message}`);
              })
          );
        }
      }
    }
    
    await Promise.all(loadPromises);
    console.log(`[gif-generator] ✅ Pre-carga completada: ${variantCache.size} variantes listas`);
  }
  
  // Generar frames del GIF
  const outputGifFrames = [];
  
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    console.log(`[gif-generator] Generando frame ${frameIndex + 1}/${totalFrames}`);
    
    let compositePng;
    let frameDelay = delay;
    
    // Si hay customFrameGenerator, usarlo
    if (customFrameGenerator) {
      const customFrame = await customFrameGenerator(frameIndex, totalFrames);
      compositePng = customFrame.pngBuffer;
      frameDelay = customFrame.delay || delay;
    } else {
      // Construir capas para este frame
      const frameLayers = [];
      
      // 1. Añadir capas estables (base, skin, traits no animados)
      for (const stableLayer of stableLayers) {
        frameLayers.push({
          pngBuffer: stableLayer.pngBuffer
        });
      }
      
      // 2. Añadir variantes de traits animados para este frame (usando caché pre-cargado)
      for (const animTrait of animatedTraits) {
        const variants = animTrait.variants || [];
        // Usar módulo para ciclar independientemente (preserva loops cerrados)
        const variantIndex = frameIndex % variants.length;
        const variantId = variants[variantIndex];
        
        if (variantId) {
          // Fase 4.2: Usar variante pre-cargada del caché
          const variantPng = variantCache.get(variantId);
          if (variantPng) {
            frameLayers.push({
              pngBuffer: variantPng
            });
          } else {
            console.warn(`[gif-generator] ⚠️ Variante ${variantId} no encontrada en caché pre-cargado`);
          }
        }
      }
      
      // 3. Componer todas las capas en un frame
      compositePng = await compositeLayers(frameLayers, width, height);
      
      // Usar delay del frame si está en frameDelays
      if (frameDelays && frameDelays[frameIndex] !== undefined) {
        frameDelay = frameDelays[frameIndex];
      }
    }
    
    // 4. Convertir PNG a GifFrame
    const pngImage = PNG.sync.read(compositePng);
    const bitmapImage = new BitmapImage({
      width: pngImage.width,
      height: pngImage.height,
      data: pngImage.data
    });
    
    const delayCentisecs = Math.round(frameDelay / 10);
    const outputFrame = new GifFrame(bitmapImage, { delayCentisecs });
    outputGifFrames.push(outputFrame);
  }
  
  // Cuantizar colores usando Sorokin para mejor calidad
  console.log(`[gif-generator] Cuantizando ${outputGifFrames.length} frames...`);
  GifUtil.quantizeSorokin(outputGifFrames, 256);
  
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
        <!-- Color rojo para traits animados, azul para normales -->
        <rect x="84" y="760" width="600" height="80" fill="#c62828"/>
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
  GifUtil.quantizeSorokin(outputGifFrames, 256);

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


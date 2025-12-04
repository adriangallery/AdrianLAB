import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { Gif, GifFrame, BitmapImage, GifUtil } from 'gifwrap';
import Jimp from 'jimp';
import { AdrianZeroRenderer } from './adrianzero-renderer.js';
import { getCachedSvgPng, setCachedSvgPng } from '../svg-png-cache.js';

export class GifRenderer {
  constructor() {
    this.adrianZeroRenderer = new AdrianZeroRenderer();
  }

  /**
   * Carga un trait SVG y lo convierte a imagen
   * @param {string|number} traitId - ID del trait
   * @param {string} category - Categoría del trait (ej: "TOP", "EYES")
   * @returns {Promise<Image|null>} - Imagen del trait o null si falla
   */
  async loadTraitImage(traitId, category = 'TOP') {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      
      // Construir ruta del trait según categoría
      let imageUrl;
      const traitIdNum = parseInt(traitId);
      
      // Lógica especial para diferentes rangos de traits
      if (traitIdNum >= 30000 && traitIdNum <= 35000) {
        // Traits externos
        imageUrl = `https://adrianzero.com/designs/${traitId}.svg`;
      } else if (traitIdNum >= 100001 && traitIdNum <= 101003) {
        // OGPunks traits
        imageUrl = `${baseUrl}/labimages/ogpunks/${traitId}.svg`;
      } else {
        // Traits normales desde labimages
        imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
      }
      
      console.log(`[GifRenderer] Cargando trait ${traitId} (${category}) desde: ${imageUrl}`);
      
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
        console.log(`[GifRenderer] Trait ${traitId} cargado desde caché`);
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
      console.log(`[GifRenderer] Trait ${traitId} cargado y convertido a PNG`);
      return image;
    } catch (error) {
      console.error(`[GifRenderer] Error cargando trait ${traitId}:`, error.message);
      return null;
    }
  }

  /**
   * Genera un frame individual combinando base AdrianZERO + trait específico
   * @param {string|number} tokenId - Token base de AdrianZERO
   * @param {string|number|null} traitId - ID del trait a aplicar (null = solo base)
   * @param {string} category - Categoría del trait (default: "TOP")
   * @returns {Promise<Buffer>} - Buffer PNG del frame
   */
  async generateFrame(tokenId, traitId = null, category = 'TOP') {
    console.log(`[GifRenderer] Generando frame para token ${tokenId}, trait ${traitId || 'none'} (${category})`);
    
    // 1. Renderizar base AdrianZERO
    const basePng = await this.adrianZeroRenderer.generatePNG(tokenId);
    const baseImage = await loadImage(basePng);
    
    // 2. Crear canvas y dibujar base
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Dibujar base AdrianZERO
    ctx.drawImage(baseImage, 0, 0, 1000, 1000);
    
    // 3. Si hay trait, cargarlo y dibujarlo encima
    if (traitId) {
      const traitImage = await this.loadTraitImage(traitId, category);
      if (traitImage) {
        ctx.drawImage(traitImage, 0, 0, 1000, 1000);
        console.log(`[GifRenderer] Trait ${traitId} aplicado al frame`);
      } else {
        console.warn(`[GifRenderer] No se pudo cargar trait ${traitId}, frame sin trait`);
      }
    }
    
    return canvas.toBuffer('image/png');
  }

  /**
   * Genera un GIF completo con múltiples frames
   * @param {object} config - Configuración del GIF
   * @param {string|number} config.tokenId - Token base de AdrianZERO
   * @param {number} config.frames - Número de frames
   * @param {Array<string|number>} config.pattern - Array de traitIds según patrón
   * @param {number} config.delay - Delay entre frames en ms (default: 100)
   * @param {string} config.category - Categoría del trait (default: "TOP")
   * @returns {Promise<Buffer>} - Buffer GIF
   */
  async generateGif(config) {
    const {
      tokenId,
      frames,
      pattern,
      delay = 100,
      category = 'TOP'
    } = config;
    
    console.log(`[GifRenderer] Iniciando generación de GIF:`, {
      tokenId,
      frames,
      pattern,
      delay,
      category
    });
    
    // Validar patrón
    if (!pattern || pattern.length === 0) {
      throw new Error('Pattern debe contener al menos un traitId');
    }
    
    // Generar frames
    const frameBuffers = [];
    for (let i = 0; i < frames; i++) {
      // Determinar qué trait usar según el patrón (ciclar si es necesario)
      const patternIndex = i % pattern.length;
      const traitId = pattern[patternIndex];
      
      console.log(`[GifRenderer] Generando frame ${i + 1}/${frames} con trait ${traitId}`);
      
      const frameBuffer = await this.generateFrame(tokenId, traitId, category);
      frameBuffers.push(frameBuffer);
    }
    
    // Convertir frames PNG a GifFrame
    const gifFrames = [];
    const delayCentisecs = Math.round(delay / 10); // Convertir ms a centisegundos
    
    for (const frameBuffer of frameBuffers) {
      // Cargar PNG en Jimp
      const jimpImage = await Jimp.read(frameBuffer);
      
      // Crear BitmapImage desde el bitmap de Jimp
      const bitmap = new BitmapImage(jimpImage.bitmap);
      
      // Crear GifFrame con delay
      const gifFrame = new GifFrame(delayCentisecs, bitmap);
      gifFrames.push(gifFrame);
    }
    
    // Crear GIF
    console.log(`[GifRenderer] Creando GIF con ${gifFrames.length} frames...`);
    const outputGif = new Gif(gifFrames, {
      loops: 0, // Loop infinito
      colorScope: Gif.ColorScope.DEFAULT
    });
    
    // Escribir GIF a buffer
    const gifBuffer = await GifUtil.write(outputGif);
    console.log(`[GifRenderer] GIF generado exitosamente (${gifBuffer.length} bytes)`);
    
    return gifBuffer;
  }
}


import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { Gif, GifFrame, BitmapImage, GifUtil } from 'gifwrap';
import { AdrianZeroRenderer } from './adrianzero-renderer.js';
import { getCachedSvgPng, setCachedSvgPng } from '../svg-png-cache.js';

export class GifRenderer {
  constructor() {
    this.adrianZeroRenderer = new AdrianZeroRenderer();
  }

  /**
   * Carga un trait SVG y lo convierte a imagen
   * @param {string|number} traitId - ID del trait
   * @param {string} category - Categoría del trait (no se usa para la ruta, solo para logging)
   * @returns {Promise<Image|null>} - Imagen del trait o null si falla
   */
  async loadTraitImage(traitId, category = null) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      
      // Construir ruta del trait (siempre desde labimages general, no por categoría)
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
        // Traits normales desde labimages (carpeta general, no por categoría)
        imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
      }
      
      const categoryLog = category ? ` (${category})` : '';
      console.log(`[GifRenderer] Cargando trait ${traitId}${categoryLog} desde: ${imageUrl}`);
      
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
   * @param {string|null} category - Categoría del trait (opcional, solo para logging)
   * @returns {Promise<Canvas>} - Canvas del frame
   */
  async generateFrame(tokenId, traitId = null, category = null) {
    const categoryLog = category ? ` (${category})` : '';
    console.log(`[GifRenderer] Generando frame para token ${tokenId}, trait ${traitId || 'none'}${categoryLog}`);
    
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
    
    return canvas;
  }

  /**
   * Genera un GIF completo con múltiples frames
   * @param {object} config - Configuración del GIF
   * @param {string|number} config.tokenId - Token base de AdrianZERO
   * @param {number} config.frames - Número de frames
   * @param {Array<string|number>} config.pattern - Array de traitIds según patrón
   * @param {number} config.delay - Delay entre frames en ms (default: 100)
   * @param {string|null} config.category - Categoría del trait (opcional, solo para logging)
   * @returns {Promise<Buffer>} - Buffer GIF
   */
  async generateGif(config) {
    const {
      tokenId,
      frames,
      pattern,
      delay = 100,
      category = null
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
    
    // Generar frames (canvas directamente)
    const frameCanvases = [];
    for (let i = 0; i < frames; i++) {
      // Determinar qué trait usar según el patrón (ciclar si es necesario)
      const patternIndex = i % pattern.length;
      const traitId = pattern[patternIndex];
      
      console.log(`[GifRenderer] Generando frame ${i + 1}/${frames} con trait ${traitId}`);
      
      const frameCanvas = await this.generateFrame(tokenId, traitId, category);
      frameCanvases.push(frameCanvas);
    }
    
    // Convertir frames canvas a GifFrame
    const gifFrames = [];
    const delayCentisecs = Math.round(delay / 10); // Convertir ms a centisegundos
    
    console.log(`[GifRenderer] Convirtiendo ${frameCanvases.length} frames canvas a GifFrame...`);
    
    for (let i = 0; i < frameCanvases.length; i++) {
      const canvas = frameCanvases[i];
      
      // Validar que el canvas existe
      if (!canvas) {
        throw new Error(`Frame ${i + 1} tiene un canvas inválido`);
      }
      
      console.log(`[GifRenderer] Procesando frame ${i + 1}/${frameCanvases.length}`);
      
      try {
        // Obtener ImageData directamente del canvas
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Crear BitmapImage desde ImageData
        // BitmapImage espera: { width, height, data } donde data es un Buffer
        // ImageData.data es Uint8ClampedArray, necesitamos convertirlo a Buffer
        const bitmap = new BitmapImage({
          width: imageData.width,
          height: imageData.height,
          data: Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength)
        });
        
        // Crear GifFrame con delay
        const gifFrame = new GifFrame(delayCentisecs, bitmap);
        gifFrames.push(gifFrame);
        
        console.log(`[GifRenderer] Frame ${i + 1} convertido exitosamente`);
      } catch (error) {
        console.error(`[GifRenderer] Error procesando frame ${i + 1}:`, error.message);
        throw new Error(`Error procesando frame ${i + 1}: ${error.message}`);
      }
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


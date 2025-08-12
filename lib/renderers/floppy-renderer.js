import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { createCanvas } from 'canvas';
import { textToSVGElement, linesToSVG } from '../text-to-svg.js';
import { getContracts } from '../contracts.js';

export class FloppyRenderer {
  constructor() {
    // Cache para traits animados
    this.animatedTraitsCache = new Map();
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Genera SVG string para el token especificado
   * @param {string|number} tokenId - Token ID
   * @param {object} options - Opciones adicionales
   * @returns {Promise<string>} - String SVG
   */
  async generateSVG(tokenId, options = {}) {
    const tokenIdNum = parseInt(tokenId);
    console.log(`[FloppyRenderer] Generando SVG para token ${tokenIdNum}`);

    // Cargar metadata del token
    const tokenData = await this.#loadMetadata(tokenIdNum);
    if (!tokenData) {
      throw new Error(`No se pudo cargar metadata para token ${tokenIdNum}`);
    }

    // Obtener total minted
    const totalMinted = await this.#getTotalMinted(tokenId, tokenData);

    // Obtener rarity
    const rarity = this.#getRarityTagAndColor(tokenData.maxSupply, tokenIdNum);

    // Detectar animaciones
    const isAnimated = await this.#isTraitAnimated(tokenData, `${tokenId}.svg`);

    // Si hay animaciones, generar formato animado
    if (isAnimated) {
      console.log('[FloppyRenderer] Trait animado detectado, generando formato animado');
      const animatedSvg = await this.#generateAnimatedSvg(tokenData);
      return animatedSvg;
    }

    // Lógica especial para serums (262144-262147) - GIF directo
    if (tokenIdNum >= 262144 && tokenIdNum <= 262147) {
      console.log(`[FloppyRenderer] 🧬 LÓGICA ESPECIAL: Serum ${tokenIdNum} detectado`);
      throw new Error(`Token ${tokenIdNum} requiere manejo especial de GIF`);
    }

    // Generar SVG estático
    return await this.#generateStaticSvg(tokenId, tokenData, totalMinted, rarity);
  }

  /**
   * Genera PNG buffer para el token especificado
   * @param {string|number} tokenId - Token ID
   * @param {object} options - Opciones adicionales
   * @returns {Promise<Buffer>} - Buffer PNG
   */
  async generatePNG(tokenId, options = {}) {
    const tokenIdNum = parseInt(tokenId);
    console.log(`[FloppyRenderer] Generando PNG para token ${tokenIdNum}`);

    // Lógica especial para serums (262144-262147) - GIF directo
    if (tokenIdNum >= 262144 && tokenIdNum <= 262147) {
      console.log(`[FloppyRenderer] 🧬 LÓGICA ESPECIAL: Serum ${tokenIdNum} detectado, sirviendo GIF directamente`);
      
      // Limpiar tokenId de extensiones si las tiene
      const cleanTokenId = tokenId.toString().replace(/\.(png|gif)$/, '');
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/${cleanTokenId}.gif`;
      console.log(`[FloppyRenderer] Ruta GIF (fetch): ${imageUrl}`);
      
      const resp = await fetch(imageUrl);
      if (!resp.ok) {
        throw new Error(`GIF no encontrado para serum ${tokenIdNum}`);
      }
      const gifArrayBuf = await resp.arrayBuffer();
      const gifBuffer = Buffer.from(gifArrayBuf);
      console.log(`[FloppyRenderer] GIF leído (fetch), tamaño: ${gifBuffer.length} bytes`);
      return gifBuffer;
    }

    // Generar SVG primero
    const svgString = await this.generateSVG(tokenId, options);

    // Convertir SVG a PNG usando Resvg
    console.log(`[FloppyRenderer] Renderizando SVG a PNG con Resvg...`);
    const resvg = new Resvg(Buffer.from(svgString), {
      fitTo: {
        mode: 'width',
        value: 768
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    console.log(`[FloppyRenderer] SVG renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);

    return pngBuffer;
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Detecta si un SVG es animado
   * @param {string} svgContent - Contenido SVG
   * @returns {boolean} - true si es animado
   */
  #detectSvgAnimation(svgContent) {
    const animationPatterns = [
      '<animate', '<animateTransform', '<animateMotion',
      '@keyframes', 'animation:', 'transition:', 'dur=', 'repeatCount='
    ];
    
    return animationPatterns.some(pattern => svgContent.includes(pattern));
  }

  /**
   * Carga SVG y detecta animación
   * @param {string} svgFileName - Nombre del archivo SVG
   * @returns {Promise<object>} - { content, isAnimated }
   */
  async #loadAndDetectAnimation(svgFileName) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/${svgFileName}`;
      console.log(`[FloppyRenderer] Cargando SVG desde URL: ${imageUrl}`);
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const svgBuffer = await response.arrayBuffer();
      const svgContent = Buffer.from(svgBuffer).toString();
      const isAnimated = this.#detectSvgAnimation(svgContent);
      
      console.log(`[FloppyRenderer] SVG cargado, tamaño: ${svgBuffer.byteLength} bytes, animado: ${isAnimated}`);
      
      return {
        content: svgContent,
        isAnimated: isAnimated
      };
    } catch (error) {
      console.error(`[FloppyRenderer] Error cargando SVG ${svgFileName}:`, error.message);
      return { content: null, isAnimated: false };
    }
  }

  /**
   * Detecta si un trait es animado
   * @param {object} traitData - Datos del trait
   * @param {string} traitPath - Path del trait
   * @returns {Promise<boolean>} - true si es animado
   */
  async #isTraitAnimated(traitData, traitPath) {
    // Prioridad 1: Metadata en traits.json
    if (traitData && traitData.animated !== undefined) {
      return traitData.animated;
    }
    
    // Prioridad 2: Cache
    if (this.animatedTraitsCache.has(traitPath)) {
      return this.animatedTraitsCache.get(traitPath);
    }
    
    // Prioridad 3: Detección dinámica
    try {
      const svgData = await this.#loadAndDetectAnimation(traitPath);
      this.animatedTraitsCache.set(traitPath, svgData.isAnimated);
      return svgData.isAnimated;
    } catch (error) {
      console.warn(`[FloppyRenderer] No se pudo detectar animación para ${traitPath}:`, error);
      return false;
    }
  }

  /**
   * Genera SVG animado (placeholder)
   * @param {object} tokenData - Datos del token
   * @returns {Promise<string>} - SVG string
   */
  async #generateAnimatedSvg(tokenData) {
    console.log('[FloppyRenderer] Generando SVG animado para trait animado');
    
    return `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="768" height="1024" fill="#ffffff"/>
        <text x="384" y="512" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="#ff0000">
          ANIMATED TRAIT DETECTED
        </text>
        <text x="384" y="562" font-family="Arial" font-size="24" text-anchor="middle" fill="#ff0000">
          GIF generation coming soon
        </text>
      </svg>
    `;
  }

  /**
   * Normaliza categorías a mayúsculas
   * @param {string} category - Categoría
   * @returns {string} - Categoría normalizada
   */
  #normalizeCategory(category) {
    const categoryMap = {
      'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
    };
    
    return categoryMap[category] || category;
  }

  /**
   * Carga trait desde labimages
   * @param {string|number} traitId - ID del trait
   * @returns {Promise<string>} - Base64 del trait
   */
  async #loadTraitFromLabimages(traitId) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const isOgpunk = parseInt(traitId) >= 100001 && parseInt(traitId) <= 101000;
      const imageUrl = isOgpunk
        ? `${baseUrl}/labimages/ogpunks/${traitId}.svg`
        : `${baseUrl}/labimages/${traitId}.svg`;
      console.log(`[FloppyRenderer] Cargando trait desde ${isOgpunk ? 'ogpunks' : 'labimages'}: ${imageUrl}`);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const svgBuffer = await response.arrayBuffer();
      console.log(`[FloppyRenderer] SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
      
      // Renderizar SVG a PNG PRIMERO
      const resvg = new Resvg(Buffer.from(svgBuffer), {
        fitTo: {
          mode: 'width',
          value: 600
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      console.log(`[FloppyRenderer] Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
      
      // Convertir a base64 para usar en <image>
      const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      return base64Image;
    } catch (error) {
      console.error(`[FloppyRenderer] Error cargando trait ${traitId} desde labimages:`, error.message);
      return null;
    }
  }

  /**
   * Carga mannequin desde labimages
   * @returns {Promise<string>} - Base64 del mannequin
   */
  async #loadMannequinFromLabimages() {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/labimages/mannequin.svg`;
      console.log(`[FloppyRenderer] Cargando mannequin desde labimages: ${imageUrl}`);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const svgBuffer = await response.arrayBuffer();
      console.log(`[FloppyRenderer] Mannequin SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
      
      // Renderizar SVG a PNG PRIMERO
      const resvg = new Resvg(Buffer.from(svgBuffer), {
        fitTo: {
          mode: 'width',
          value: 600
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      console.log(`[FloppyRenderer] Mannequin renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
      
      // Convertir a base64 para usar en <image>
      const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      return base64Image;
    } catch (error) {
      console.error(`[FloppyRenderer] Error cargando mannequin desde labimages:`, error.message);
      return null;
    }
  }

  /**
   * Carga trait desde URL externa para tokens 30000-35000
   * @param {string|number} traitId - ID del trait
   * @returns {Promise<string>} - Base64 del trait
   */
  async #loadExternalTraitForFloppy(traitId) {
    try {
      const baseUrl = 'https://adrianzero.com/designs';
      const imageUrl = `${baseUrl}/${traitId}.svg`;
      console.log(`[FloppyRenderer] 🌐 Cargando trait ${traitId} desde URL externa: ${imageUrl}`);

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const svgBuffer = await response.arrayBuffer();
      console.log(`[FloppyRenderer] 🌐 SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
      
      // Renderizar SVG a PNG
      const resvg = new Resvg(Buffer.from(svgBuffer), {
        fitTo: {
          mode: 'width',
          value: 600
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      console.log(`[FloppyRenderer] 🌐 Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
      
      // Convertir a base64 para usar en <image>
      const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      console.log(`[FloppyRenderer] 🌐 LÓGICA EXTERNA: Trait ${traitId} cargado exitosamente desde URL externa`);
      return base64Image;
    } catch (error) {
      console.error(`[FloppyRenderer] 🌐 LÓGICA EXTERNA: Error cargando trait ${traitId} desde URL externa:`, error.message);
      return null;
    }
  }

  /**
   * Carga metadata del token
   * @param {number} tokenIdNum - Token ID numérico
   * @returns {Promise<object>} - Datos del token
   */
  async #loadMetadata(tokenIdNum) {
    let traitData;
    
    if (tokenIdNum === 262144) {
      // Cargar datos de serums.json para token 262144
      const serumsPath = path.join(process.cwd(), 'public', 'labmetadata', 'serums.json');
      
      try {
        const serumsBuffer = fs.readFileSync(serumsPath);
        const serumsData = JSON.parse(serumsBuffer.toString());
        console.log(`[FloppyRenderer] Serums data cargado, ${serumsData.serums.length} serums encontrados`);
        
        traitData = serumsData.serums.find(serum => serum.tokenId === tokenIdNum);
      } catch (error) {
        console.error('[FloppyRenderer] Error cargando serums data:', error);
        throw new Error('Error cargando datos de serums');
      }
    } else if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
      // Cargar datos de studio.json para tokens 30000-35000
      const studioPath = path.join(process.cwd(), 'public', 'labmetadata', 'studio.json');
      
      try {
        const studioBuffer = fs.readFileSync(studioPath);
        const studioData = JSON.parse(studioBuffer.toString());
        console.log(`[FloppyRenderer] Studio data cargado, ${Object.keys(studioData).length} tokens encontrados`);
        
        traitData = studioData[tokenIdNum.toString()];
      } catch (error) {
        console.error('[FloppyRenderer] Error cargando studio data:', error);
        throw new Error('Error cargando datos de studio');
      }
    } else if (tokenIdNum >= 100001 && tokenIdNum <= 101000) {
      // Cargar datos de ogpunks.json para tokens 100001-101000
      const ogpunksPath = path.join(process.cwd(), 'public', 'labmetadata', 'ogpunks.json');
      try {
        const ogpunksBuffer = fs.readFileSync(ogpunksPath);
        const ogpunksData = JSON.parse(ogpunksBuffer.toString());
        console.log(`[FloppyRenderer] OGPUNKS data cargado, ${ogpunksData.traits.length} tokens encontrados`);
        traitData = ogpunksData.traits.find(t => t.tokenId === tokenIdNum);
      } catch (error) {
        console.error('[FloppyRenderer] Error cargando ogpunks data:', error);
        throw new Error('Error cargando datos de ogpunks');
      }
    } else {
      // Cargar datos de labmetadata para tokens 1-9999
      const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
      
      try {
        const labmetadataBuffer = fs.readFileSync(labmetadataPath);
        const labmetadata = JSON.parse(labmetadataBuffer.toString());
        console.log(`[FloppyRenderer] Labmetadata cargado, ${labmetadata.traits.length} traits encontrados`);
        
        traitData = labmetadata.traits.find(trait => trait.tokenId === tokenIdNum);
      } catch (error) {
        console.error('[FloppyRenderer] Error cargando labmetadata:', error);
        throw new Error('Error cargando datos de traits');
      }
    }
    
    if (!traitData) {
      console.log(`[FloppyRenderer] Trait no encontrado para tokenId ${tokenIdNum}, usando datos genéricos`);
      traitData = {
        name: `TRAIT #${tokenIdNum}`,
        category: "UNKNOWN",
        maxSupply: 300
      };
    } else {
      console.log(`[FloppyRenderer] Trait encontrado:`, JSON.stringify(traitData, null, 2));
    }

    return traitData;
  }

  /**
   * Obtiene total minted del contrato
   * @param {string|number} tokenId - Token ID
   * @param {object} tokenData - Datos del token
   * @returns {Promise<number>} - Total minted
   */
  async #getTotalMinted(tokenId, tokenData) {
    let totalMinted = 0;
    
    try {
      console.log(`[FloppyRenderer] Obteniendo totalMintedPerAsset para trait ${tokenId}...`);
      const { traitsCore } = await getContracts();
      const mintedAmount = await traitsCore.totalMintedPerAsset(tokenId);
      console.log(`[FloppyRenderer] TotalMintedPerAsset obtenido: ${mintedAmount.toString()}`);
      
      totalMinted = mintedAmount.toNumber();
      console.log(`[FloppyRenderer] Total minted obtenido del contrato: ${totalMinted}`);
    } catch (error) {
      console.error(`[FloppyRenderer] Error obteniendo totalMintedPerAsset:`, error.message);
      totalMinted = tokenData.maxSupply;
      console.log(`[FloppyRenderer] Usando fallback: totalMinted = maxSupply = ${totalMinted}`);
    }

    return totalMinted;
  }

  /**
   * Obtiene tag y color de rareza
   * @param {number} maxSupply - Max supply del token
   * @param {number} tokenIdNum - Token ID numérico
   * @returns {object} - { tag, bg }
   */
  #getRarityTagAndColor(maxSupply, tokenIdNum) {
    // LÓGICA ESPECIAL: Tokens 30000-35000 tienen tag hardcodeado
    if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
      return { tag: 'TraitSTUDIO', bg: '#ff6b35' };  // Naranja para T-shirts personalizados
    }
    
    if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
    if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
    if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
    if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
    return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
  }

  /**
   * Genera SVG estático completo
   * @param {string|number} tokenId - Token ID
   * @param {object} tokenData - Datos del token
   * @param {number} totalMinted - Total minted
   * @param {object} rarity - Datos de rareza
   * @returns {Promise<string>} - SVG string
   */
  async #generateStaticSvg(tokenId, tokenData, totalMinted, rarity) {
    const tokenIdNum = parseInt(tokenId);
    console.log(`[FloppyRenderer] Generando SVG estático para token ${tokenIdNum}`);

    // Cargar trait y mannequin
    let traitImageData;
    if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
      traitImageData = await this.#loadExternalTraitForFloppy(tokenId);
      if (!traitImageData) {
        throw new Error(`No se pudo cargar el trait ${tokenId} desde URL externa`);
      }
    } else {
      traitImageData = await this.#loadTraitFromLabimages(tokenId);
      if (!traitImageData) {
        throw new Error(`No se pudo cargar el trait ${tokenId}`);
      }
    }

    const mannequinImageData = await this.#loadMannequinFromLabimages();
    if (!mannequinImageData) {
      throw new Error('No se pudo cargar el mannequin');
    }

    // Cargar frameimproved.svg por fetch y embebido inline
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const frameUrl = `${baseUrl}/labimages/frameimproved.svg`;
    let frameInline = '';
    try {
      const resp = await fetch(frameUrl);
      if (resp.ok) {
        let frameSvg = await resp.text();
        frameSvg = frameSvg
          .replace(/<\?xml[^>]*\?>/, '')
          .replace(/<svg[^>]*>/, '')
          .replace(/<\/svg>/, '');
        frameInline = frameSvg;
      } else {
        console.warn(`[FloppyRenderer] No se pudo cargar frameimproved.svg (${resp.status}), se omite el frame`);
      }
    } catch (e) {
      console.warn(`[FloppyRenderer] Error cargando frameimproved.svg: ${e.message}`);
    }

    // Crear SVG completo con texto convertido a paths
    const completeSvg = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Capa base en gris claro (bajo todos los elementos) -->
        <rect width="768" height="1024" fill="#f5f5f5"/>
        
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
          x: 84 + 160 / 2,  // Centro horizontal del rectángulo
          y: 120 + 60 / 2,  // Centro vertical del rectángulo
          fontSize: 32,     // Tamaño equilibrado
          fill: '#ffffff',
          anchor: 'center middle'
        })}
        
        <!-- Nombre del trait (debajo de la imagen) - convertido a path -->
        <rect x="84" y="760" width="600" height="80" fill="#0f4e6d"/>
        ${textToSVGElement(tokenData.name, {
          x: 84 + 600 / 2,  // Centro horizontal del rectángulo
          y: 760 + 80 / 2,  // Centro vertical del rectángulo
          fontSize: 70,
          fill: '#ffffff',
          anchor: 'center middle'
        })}
        
        <!-- Bloque inferior de datos - convertido a paths -->
        ${linesToSVG([
          {
            text: `CATEGORY: ${tokenData.category}`,
            x: 84 + 10,  // Margen izquierdo de 10px
            y: 880,
            fontSize: 32,  // Aumentado de 24 a 32
            fill: '#333333',
            anchor: 'start middle'
          },
          {
            text: `TOTAL MINTED: ${totalMinted}`,
            x: 84 + 10,  // Margen izquierdo de 10px
            y: 915,
            fontSize: 32,  // Aumentado de 24 a 32
            fill: '#333333',
            anchor: 'start middle'
          },
          {
            text: `FLOPPY: ${tokenData.floppy || 'OG'}`,
            x: 84 + 10,  // Margen izquierdo de 10px
            y: 950,
            fontSize: 32,  // Aumentado de 24 a 32
            fill: '#333333',
            anchor: 'start middle'
          }
        ])}
        
        <!-- Logo AdrianLAB (alineado a la derecha) - convertido a paths -->
        ${textToSVGElement('Adrian', {
          x: 684 - 143, // Movido otros 12px a la derecha (de -155 a -143)
          y: 922,       // Subido 3px (de 925 a 922)
          fontSize: 56,
          fill: '#333333',
          anchor: 'end'
        })}
        
        ${textToSVGElement('LAB', {
          x: 684 - 143, // Movido otros 12px a la derecha (de -155 a -143)
          y: 957,       // Subido 3px (de 960 a 957)
          fontSize: 56,
          fill: '#ff69b4',
          anchor: 'end'
        })}
      </svg>
    `;

    console.log(`[FloppyRenderer] SVG estático generado para token ${tokenIdNum}`);
    return completeSvg;
  }
} 
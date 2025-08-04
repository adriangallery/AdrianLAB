import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { getContracts } from '../contracts.js';

export class AdrianZeroRenderer {
  constructor() {
    // Cache para traits animados
    this.animatedTraitsCache = new Map();
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Genera PNG buffer para el token especificado
   * @param {string|number} tokenId - Token ID
   * @param {object} options - Opciones adicionales
   * @returns {Promise<Buffer>} - Buffer PNG
   */
  async generatePNG(tokenId, options = {}) {
    const tokenIdNum = parseInt(tokenId);
    console.log(`[AdrianZeroRenderer] Generando PNG para token ${tokenIdNum}`);

    // Usar exactamente la misma lógica que el endpoint original
    return await this.#generatePNGInternal(tokenId);
  }

  /**
   * Genera SVG string para el token especificado
   * @param {string|number} tokenId - Token ID
   * @param {object} options - Opciones adicionales
   * @returns {Promise<string>} - String SVG
   */
  async generateSVG(tokenId, options = {}) {
    const tokenIdNum = parseInt(tokenId);
    console.log(`[AdrianZeroRenderer] Generando SVG para token ${tokenIdNum}`);

    // Por ahora, generar PNG y convertir a SVG placeholder
    // TODO: Implementar generación directa de SVG
    const pngBuffer = await this.generatePNG(tokenId, options);
    
    // Convertir PNG a SVG placeholder (temporal)
    return `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="1000" fill="#f0f0f0"/>
        <text x="500" y="450" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="#333">
          AdrianZERO ${tokenId}
        </text>
        <text x="500" y="500" font-family="Arial" font-size="24" text-anchor="middle" fill="#333">
          SVG generation coming soon
        </text>
      </svg>
    `;
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Genera PNG usando la lógica exacta del endpoint original
   * @param {string|number} tokenId - Token ID
   * @returns {Promise<Buffer>} - Buffer PNG
   */
  async #generatePNGInternal(tokenId) {
    const cleanTokenId = tokenId.toString().replace('.png', '');
    console.log(`[AdrianZeroRenderer] Iniciando renderizado para token ${cleanTokenId}`);

    // Conectar con los contratos
    console.log('[AdrianZeroRenderer] Conectando con los contratos...');
    const { core, traitsExtension, patientZero, serumModule } = await getContracts();

    // Obtener datos del token
    console.log('[AdrianZeroRenderer] Obteniendo datos del token...');
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    
    console.log('[AdrianZeroRenderer] TokenData:', {
      generation: generation.toString(),
      mutationLevel: mutationLevel.toString(),
      canReplicate,
      hasBeenModified
    });

    // Obtener skin del token
    console.log('[AdrianZeroRenderer] Obteniendo skin del token...');
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log('[AdrianZeroRenderer] Skin info:', {
      skinId,
      skinName
    });

    // Obtener traits equipados
    console.log('[AdrianZeroRenderer] Obteniendo traits equipados...');
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    console.log('[AdrianZeroRenderer] Traits equipados (anidado):', {
      categories,
      traitIds: traitIds.map(id => id.toString())
    });

    // Crear canvas con fondo blanco
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    console.log('[AdrianZeroRenderer] Canvas creado con fondo blanco');

    // Función para cargar y renderizar SVG
    const loadAndRenderSvg = async (path) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/traits/${path}`;
        console.log(`[AdrianZeroRenderer] Cargando imagen: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        return loadImage(pngBuffer);
      } catch (error) {
        console.error(`[AdrianZeroRenderer] Error cargando imagen ${path}:`, error.message);
        return null;
      }
    };

    // Función para cargar SVG de Adrian
    const loadAdrianSvg = async (serumName, generation, skinType) => {
      try {
        let adrianPath;
        
        if (serumName === 'ADRIANGF') {
          adrianPath = `ADRIANGF/GEN${generation}-${skinType}.svg`;
        } else {
          adrianPath = `ADRIAN/GEN${generation}-${skinType}.svg`;
        }
        
        return await loadAndRenderSvg(adrianPath);
      } catch (error) {
        console.error(`[AdrianZeroRenderer] Error cargando Adrian SVG:`, error.message);
        return null;
      }
    };

    // Función para cargar trait desde labimages
    const loadTraitFromLabimages = async (traitId) => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
        const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
        console.log(`[AdrianZeroRenderer] Cargando trait desde labimages: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        return loadImage(pngBuffer);
      } catch (error) {
        console.error(`[AdrianZeroRenderer] Error cargando trait ${traitId} desde labimages:`, error.message);
        return null;
      }
    };

    // Función para cargar trait desde URL externa para tokens 30000-35000
    const loadExternalTrait = async (traitId) => {
      try {
        const baseUrl = 'https://adrianzero.com/designs';
        const imageUrl = `${baseUrl}/${traitId}.svg`;
        console.log(`[AdrianZeroRenderer] 🌐 Cargando trait ${traitId} desde URL externa: ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const svgBuffer = await response.arrayBuffer();
        console.log(`[AdrianZeroRenderer] 🌐 SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
        
        // Renderizar SVG a PNG
        const resvg = new Resvg(Buffer.from(svgBuffer), {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        console.log(`[AdrianZeroRenderer] 🌐 Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
        
        const image = await loadImage(pngBuffer);
        console.log(`[AdrianZeroRenderer] 🌐 LÓGICA EXTERNA: Trait ${traitId} cargado exitosamente desde URL externa`);
        return image;
      } catch (error) {
        console.error(`[AdrianZeroRenderer] 🌐 LÓGICA EXTERNA: Error cargando trait ${traitId} desde URL externa:`, error.message);
        console.error(`[AdrianZeroRenderer] 🌐 LÓGICA EXTERNA: Stack trace:`, error.stack);
        return null;
      }
    };

    // Determinar la imagen base según generación y skin
    const gen = generation.toString();
    let baseImagePath;

    // Mapear skin para determinar la imagen a mostrar
    let skinType;
    let useMannequin = false;
    
    console.log('[AdrianZeroRenderer] Analizando skin:', {
      skinId,
      skinName,
      generacion: gen
    });
    
    // Lógica del skin basada en el contrato:
    // - skinId = 0: No hay skin asignado (usar mannequin.svg)
    // - skinId = 1: Skin "Zero" (usar Medium)
    // - skinId = 2: Skin "Dark" (usar Dark)
    // - skinId = 3: Skin "Alien" (usar Alien)
    // - skinId = 4: Skin "Albino" (usar Albino)
    if (skinId.toString() === "0") {
      useMannequin = true;
      console.log('[AdrianZeroRenderer] Skin no asignado detectado (skinId = 0), usando mannequin.svg');
    } else if (skinId.toString() === "1" || skinName === "Zero") {
      skinType = "Medium";
      console.log('[AdrianZeroRenderer] Skin Zero detectado (skinId = 1), usando Medium');
    } else if (skinId.toString() === "2" || skinName === "Dark") {
      skinType = "Dark";
      console.log('[AdrianZeroRenderer] Skin Dark detectado (skinId = 2), usando Dark');
    } else if (skinId.toString() === "3" || skinName === "Alien") {
      skinType = "Alien";
      console.log('[AdrianZeroRenderer] Skin Alien detectado (skinId = 3), usando Alien');
    } else if (skinId.toString() === "4" || skinName === "Albino") {
      skinType = "Albino";
      console.log('[AdrianZeroRenderer] Skin Albino detectado (skinId = 4), usando Albino');
    } else {
      skinType = skinName || "Medium";
      console.log(`[AdrianZeroRenderer] Skin personalizado detectado: ${skinName} (skinId = ${skinId})`);
    }

    // Construir path del Adrian base (solo si no usamos mannequin)
    if (!useMannequin) {
      baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
    }
    console.log('[AdrianZeroRenderer] Path de imagen base:', baseImagePath);
    console.log('[AdrianZeroRenderer] Mapeo aplicado:', {
      skinId,
      skinName,
      skinTypeSeleccionado: skinType
    });

    // Crear mapa de traits equipados
    const equippedTraits = {};
    categories.forEach((category, index) => {
      const normalizedCategory = this.#normalizeCategory(category);
      const traitId = traitIds[index].toString();
      
      // LÓGICA ESPECIAL: Si es HEAD y está en la lista de tokens que deben ser HAIR
      if (normalizedCategory === 'HEAD' && this.#shouldRenderAsHair(traitId)) {
        console.log(`[AdrianZeroRenderer] LÓGICA ESPECIAL: Token ${traitId} (${normalizedCategory}) será renderizado como HAIR`);
        equippedTraits['HAIR'] = traitId;
      } else {
        equippedTraits[normalizedCategory] = traitId;
      }
    });

    // Verificar si hay un trait de skin excepcional
    let skinTraitPath = null;
    if (equippedTraits['SKIN']) {
      skinTraitPath = this.#getSkinTraitPath(equippedTraits['SKIN'], gen);
      if (skinTraitPath) {
        console.log(`[AdrianZeroRenderer] Detectado trait de skin excepcional: ${skinTraitPath}`);
      }
    }

    // LÓGICA ESPECIAL: Detectar serum aplicado y cambiar skin base
    let appliedSerum = null;
    let serumFailed = false;
    try {
      console.log('[AdrianZeroRenderer] Verificando si hay serum aplicado...');
      const serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        const lastSerum = serumHistory[serumHistory.length - 1];
        const serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        console.log(`[AdrianZeroRenderer] Historial de serum encontrado:`, {
          success: serumSuccess,
          mutation: serumMutation,
          hasBeenModified: hasBeenModified
        });
        
        // LÓGICA CORREGIDA según el contrato SerumModule (consistente con metadata):
        // - Serum exitoso: success = true Y mutation tiene valor
        // - Serum fallido: success = false (independientemente del valor de mutation)
        if (serumSuccess) {
          // Serum exitoso
          if (serumMutation) {
            appliedSerum = serumMutation;
            console.log(`[AdrianZeroRenderer] Serum exitoso detectado: ${appliedSerum}`);
          } else {
            console.warn(`[AdrianZeroRenderer] Serum marcado como exitoso pero sin mutación, esto no debería pasar`);
          }
        } else {
          // Serum fallido (consistente con metadata: "FAILED")
          serumFailed = true;
          console.log(`[AdrianZeroRenderer] Serum fallido detectado: success = false (será "FAILED" en metadata)`);
        }
      }
    } catch (error) {
      console.log('[AdrianZeroRenderer] Error verificando serum aplicado:', error.message);
    }

    // DETECCIÓN DE ANIMACIONES
    console.log('[AdrianZeroRenderer] Iniciando detección de animaciones...');
    
    // Cargar datos de traits.json para verificar metadata
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    let labmetadata;
    try {
      const labmetadataBuffer = fs.readFileSync(labmetadataPath);
      labmetadata = JSON.parse(labmetadataBuffer.toString());
    } catch (error) {
      console.warn('[AdrianZeroRenderer] No se pudo cargar traits.json para detección de animaciones');
      labmetadata = { traits: [] };
    }

    // Detectar si hay traits animados
    const hasAnyAnimation = await Promise.all(
      Object.entries(equippedTraits).map(async ([category, traitId]) => {
        // Aplicar corrección de categoría para tokens mal categorizados
        const correctedCategory = this.#correctCategory(category, traitId);
        const traitPath = `${correctedCategory}/${traitId}.svg`;
        const traitData = labmetadata.traits.find(t => t.tokenId === parseInt(traitId));
        const isAnimated = await this.#isTraitAnimated(traitData, traitPath);
        
        if (isAnimated) {
          console.log(`[AdrianZeroRenderer] Trait animado detectado: ${correctedCategory}/${traitId}`);
        }
        
        return isAnimated;
      })
    ).then(results => results.some(Boolean));

    console.log(`[AdrianZeroRenderer] Animaciones detectadas: ${hasAnyAnimation}`);

    // Si hay animaciones, generar GIF (por ahora PNG con indicador)
    if (hasAnyAnimation) {
      console.log('[AdrianZeroRenderer] Generando formato animado...');
      const animatedBuffer = await this.#generateAnimatedGif(equippedTraits, baseImagePath, skinTraitPath);
      return animatedBuffer;
    }

    // ===== RENDERIZADO NORMAL =====
    console.log('[AdrianZeroRenderer] Iniciando renderizado normal...');

    // 1. PRIMERO: Renderizar imagen base (Adrian o mannequin)
    console.log('[AdrianZeroRenderer] PASO 1 - Iniciando renderizado de imagen base');
    if (useMannequin) {
      const mannequinPath = 'ADRIAN/mannequin.svg';
      console.log(`[AdrianZeroRenderer] PASO 1 - Cargando mannequin: ${mannequinPath}`);

      const mannequinImage = await loadAndRenderSvg(mannequinPath);
      if (mannequinImage) {
        ctx.drawImage(mannequinImage, 0, 0, 1000, 1000);
        console.log(`[AdrianZeroRenderer] PASO 1 - Mannequin renderizado correctamente`);
      } else {
        console.error(`[AdrianZeroRenderer] PASO 1 - Error al cargar mannequin`);
      }
    } else {
      console.log(`[AdrianZeroRenderer] PASO 1 - Cargando imagen base: ${baseImagePath}`);

      const baseImage = await loadAndRenderSvg(baseImagePath);
      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, 1000, 1000);
        console.log(`[AdrianZeroRenderer] PASO 1 - Imagen base renderizada correctamente`);
      } else {
        console.error(`[AdrianZeroRenderer] PASO 1 - Error al cargar imagen base`);
      }
    }

    // 2. SEGUNDO: Renderizar trait de skin excepcional (si existe)
    if (skinTraitPath) {
      console.log(`[AdrianZeroRenderer] PASO 2.5 - Renderizando trait de skin excepcional: ${skinTraitPath}`);
      const skinTraitId = equippedTraits['SKIN'];
      
      const skinTraitImage = await loadAndRenderSvg(skinTraitPath);
      if (skinTraitImage) {
        ctx.drawImage(skinTraitImage, 0, 0, 1000, 1000);
        console.log(`[AdrianZeroRenderer] PASO 2.5 - Skin trait especial ${skinTraitId} renderizado correctamente`);
      }
    }

    // 3. TERCERO: Renderizar resto de traits
    console.log('[AdrianZeroRenderer] PASO 3 - Iniciando renderizado de traits adicionales');
    // Nuevo orden de renderizado: HAIR después de SWAG para que se renderice encima
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'HEAD', 'RANDOMSHIT', 'SWAG', 'HAIR', 'HAT', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];

    for (const category of traitOrder) {
      if (equippedTraits[category]) {
        // LÓGICA ESPECIAL: No renderizar HAIR 21 si HEAD 209 está activo
        if (category === 'HAIR' && equippedTraits['HAIR'] === '21' && equippedTraits['HEAD'] === '209') {
          console.log('[AdrianZeroRenderer] LÓGICA ESPECIAL: No renderizar HAIR 21 porque HEAD 209 está activo');
          continue;
        }
        // Solo para traits visuales normales (no ADRIAN ni ADRIANGF)
        if (category !== 'ADRIAN' && category !== 'ADRIANGF') {
          // LÓGICA DE EXCLUSIVIDAD: SERUMS solo si NO hay EYES
          if (category === 'SERUMS') {
            const eyesTrait = equippedTraits['EYES'];
            if (eyesTrait && eyesTrait !== 'None' && eyesTrait !== '') {
              console.log(`[AdrianZeroRenderer] PASO 3 - 🚫 LÓGICA DE EXCLUSIVIDAD: Saltando SERUMS (${equippedTraits[category]}) porque hay EYES (${eyesTrait}) activado`);
              continue; // Saltar SERUMS si hay EYES activados
            }
          }
          const traitId = equippedTraits[category];
          
          // LÓGICA ESPECIAL: Tokens 30000-35000 usan URL externa
          let traitImage;
          if (traitId >= 30000 && traitId <= 35000) {
            traitImage = await loadExternalTrait(traitId);
            if (traitImage) {
              ctx.drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[AdrianZeroRenderer] PASO 3 - 🌐 Trait ${category} (${traitId}) renderizado desde URL externa correctamente`);
            } else {
              console.error(`[AdrianZeroRenderer] PASO 3 - 🌐 Error al cargar trait ${category} (${traitId}) desde URL externa`);
            }
          } else {
            traitImage = await loadTraitFromLabimages(traitId);
            if (traitImage) {
              ctx.drawImage(traitImage, 0, 0, 1000, 1000);
              console.log(`[AdrianZeroRenderer] PASO 3 - Trait ${category} (${traitId}) renderizado desde labimages correctamente`);
            } else {
              console.error(`[AdrianZeroRenderer] PASO 3 - Error al cargar trait ${category} (${traitId}) desde labimages`);
            }
          }
        }
      }
    }

    // 4. CUARTO: Renderizar TOP layers (van encima de todas las demás)
    console.log('[AdrianZeroRenderer] PASO 4 - Iniciando renderizado de TOP layers');
    const topOrder = ['TOP'];

    for (const category of topOrder) {
      if (equippedTraits[category]) {
        const traitId = equippedTraits[category];
        console.log(`[AdrianZeroRenderer] PASO 4 - Cargando TOP trait: ${traitId}`);

        // LÓGICA ESPECIAL: Tokens 30000-35000 usan URL externa
        let traitImage;
        if (traitId >= 30000 && traitId <= 35000) {
          traitImage = await loadExternalTrait(traitId);
          if (traitImage) {
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[AdrianZeroRenderer] PASO 4 - 🌐 TOP trait ${category} (${traitId}) renderizado desde URL externa correctamente`);
          } else {
            console.error(`[AdrianZeroRenderer] PASO 4 - 🌐 Error al cargar TOP trait ${category} (${traitId}) desde URL externa`);
          }
        } else {
          traitImage = await loadTraitFromLabimages(traitId);
          if (traitImage) {
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[AdrianZeroRenderer] PASO 4 - TOP trait ${category} (${traitId}) renderizado desde labimages correctamente`);
          } else {
            console.error(`[AdrianZeroRenderer] PASO 4 - Error al cargar TOP trait ${category} (${traitId}) desde labimages`);
          }
        }
      }
    }

    // LÓGICA ESPECIAL: Renderizar token 48 (S.W.A.T-Shild) en TOP
    if (equippedTraits['GEAR'] === '48') {
      const specialTraitPath = `GEAR/48.svg`;
      console.log(`[AdrianZeroRenderer] PASO 4 - 🎯 LÓGICA ESPECIAL: Renderizando token 48 en TOP: ${specialTraitPath}`);

      const specialTraitImage = await loadAndRenderSvg(specialTraitPath);
      if (specialTraitImage) {
        ctx.drawImage(specialTraitImage, 0, 0, 1000, 1000);
        console.log(`[AdrianZeroRenderer] PASO 4 - 🎯 Token 48 renderizado correctamente en TOP`);
      }
    }

    // Retornar buffer PNG
    const buffer = canvas.toBuffer('image/png');
    console.log('[AdrianZeroRenderer] Renderizado completado exitosamente');
    return buffer;
  }

  // ===== FUNCIONES AUXILIARES =====

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
   * @param {string} svgPath - Path del SVG
   * @returns {Promise<object>} - { content, isAnimated }
   */
  async #loadAndDetectAnimation(svgPath) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
      const imageUrl = `${baseUrl}/traits/${svgPath}`;
      
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const svgContent = await response.text();
      const isAnimated = this.#detectSvgAnimation(svgContent);
      
      return {
        content: svgContent,
        isAnimated: isAnimated
      };
    } catch (error) {
      console.error(`[AdrianZeroRenderer] Error cargando SVG ${svgPath}:`, error.message);
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
      console.warn(`[AdrianZeroRenderer] No se pudo detectar animación para ${traitPath}:`, error);
      return false;
    }
  }

  /**
   * Genera GIF animado (placeholder)
   * @param {object} equippedTraits - Traits equipados
   * @param {string} baseImagePath - Path de imagen base
   * @param {string} skinTraitPath - Path del trait de skin
   * @returns {Promise<Buffer>} - Buffer PNG
   */
  async #generateAnimatedGif(equippedTraits, baseImagePath, skinTraitPath) {
    console.log('[AdrianZeroRenderer] Generando GIF animado para traits animados');
    
    // Crear canvas con fondo blanco
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Añadir indicador de animación
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ANIMATED TRAIT DETECTED', 500, 500);
    ctx.fillText('GIF generation coming soon', 500, 550);
    
    return canvas.toBuffer('image/png');
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
   * Determina si un trait debe renderizarse como HAIR
   * @param {string|number} traitId - ID del trait
   * @returns {boolean} - true si debe renderizarse como HAIR
   */
  #shouldRenderAsHair(traitId) {
    const hairTraitIds = ['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99', '100'];
    return hairTraitIds.includes(traitId.toString());
  }

  /**
   * Corrige categoría según trait ID
   * @param {string} category - Categoría original
   * @param {string|number} traitId - ID del trait
   * @returns {string} - Categoría corregida
   */
  #correctCategory(category, traitId) {
    // Lógica especial para ciertos traits
    if (this.#shouldRenderAsHair(traitId)) {
      return 'HAIR';
    }
    return category;
  }

  /**
   * Determina si un trait de skin es excepcional
   * @param {string|number} traitId - ID del trait
   * @returns {boolean} - true si es excepcional
   */
  #isSkinTraitException(traitId) {
    const skinExceptions = ['37', '38', '39', '40', '41', '42'];
    return skinExceptions.includes(traitId.toString());
  }

  /**
   * Obtiene el path del trait de skin
   * @param {string|number} traitId - ID del trait
   * @param {number} generation - Generación
   * @returns {string|null} - Path del trait o null
   */
  #getSkinTraitPath(traitId, generation) {
    if (this.#isSkinTraitException(traitId)) {
      return `SKIN/OG_GEN${generation}_3D.svg`;
    }
    return null;
  }
} 
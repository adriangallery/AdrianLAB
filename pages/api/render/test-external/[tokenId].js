// API endpoint de test para renderizar tokens con traits externos
import { createCanvas, loadImage } from 'canvas';
import { getContracts } from '../../../../lib/contracts.js';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

// Función para normalizar categorías a mayúsculas
const normalizeCategory = (category) => {
  const categoryMap = {
    'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
  };
  
  const normalized = categoryMap[category] || category;
  return normalized;
};

// Función para cargar SVG desde URL externa
const loadExternalSvg = async (url) => {
  try {
    console.log(`[test-external] Cargando SVG desde URL externa: ${url}`);
    
    const response = await fetch(url);
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
    console.error(`[test-external] Error cargando SVG externo:`, error.message);
    return null;
  }
};

// Función para cargar SVG desde sistema local
const loadAndRenderSvg = async (path) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/traits/${path}`;
    console.log(`[test-external] Cargando imagen local: ${imageUrl}`);

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
    console.error(`[test-external] Error cargando SVG local ${path}:`, error.message);
    return null;
  }
};

// Función específica para cargar archivos ADRIAN desde sistema de archivos
const loadAdrianSvg = async (serumName, generation, skinType) => {
  try {
    // LÓGICA ESPECIAL PARA ADRIANGF: Usar estructura de carpetas específica
    if (serumName === "AdrianGF") {
      console.log(`[test-external] 🧬 LÓGICA ESPECIAL: Cargando skin ADRIANGF para GEN${generation}, skin ${skinType}`);
      
      // Mapear skinType a formato de archivo
      let skinFileName;
      if (skinType === "Albino") {
        skinFileName = `GEN${generation}_Albino.svg`;
      } else {
        // Para otros skins: GF{gen}-{skinType}.svg
        skinFileName = `GF${generation}-${skinType}.svg`;
      }
      
      const adrianGfPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', `GF${generation}`, skinFileName);
      console.log(`[test-external] Cargando ADRIANGF desde sistema de archivos: ${adrianGfPath}`);
      
      const svgContent = fs.readFileSync(adrianGfPath, 'utf8');
      
      // Renderizar SVG a PNG
      const resvg = new Resvg(svgContent, {
        fitTo: {
          mode: 'width',
          value: 1000
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      return loadImage(pngBuffer);
    } else {
      // Lógica original para otros serums
      const serumNameUpper = serumName.toUpperCase();
      const adrianPath = path.join(process.cwd(), 'public', 'traits', 'ADRIAN', `${serumNameUpper}.svg`);
      console.log(`[test-external] Cargando Adrian desde sistema de archivos: ${adrianPath}`);
      
      const svgContent = fs.readFileSync(adrianPath, 'utf8');
      
      // Renderizar SVG a PNG
      const resvg = new Resvg(svgContent, {
        fitTo: {
          mode: 'width',
          value: 1000
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      return loadImage(pngBuffer);
    }
  } catch (error) {
    console.error(`[test-external] Error cargando Adrian SVG ${serumName}:`, error.message);
    return null;
  }
};

// Función para cargar trait desde labimages
const loadTraitFromLabimages = async (traitId) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
    console.log(`[test-external] Cargando trait desde labimages: ${imageUrl}`);

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
    console.error(`[test-external] Error cargando trait ${traitId} desde labimages:`, error.message);
    return null;
  }
};

export default async function handler(req, res) {
  // Configurar CORS
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianlab.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extraer tokenId de la ruta
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    console.log(`[test-external] Iniciando test de renderizado externo para token ${cleanTokenId}`);

    // Verificar tokenId
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[test-external] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // Obtener parámetros de query para traits personalizados
    const customTraits = {};
    
    // Procesar parámetros de categorías directas
    Object.keys(req.query).forEach(key => {
      if (key !== 'tokenId' && key !== 'png' && key !== 'trait') {
        const traitValue = req.query[key];
        const traitId = parseInt(traitValue);
        if (!isNaN(traitId)) {
          customTraits[key.toUpperCase()] = traitId.toString();
          console.log(`[test-external] Categoría ${key.toUpperCase()} = ${traitId}`);
        }
      }
    });
    
    // Procesar parámetros "trait"
    if (req.query.trait) {
      const traitValues = Array.isArray(req.query.trait) ? req.query.trait : [req.query.trait];
      traitValues.forEach(traitValue => {
        const traitId = parseInt(traitValue);
        if (!isNaN(traitId)) {
          // Para este test, asumimos que trait 30003 es externo
          if (traitId === 30003) {
            customTraits['EXTERNAL_TEST'] = traitId.toString();
            console.log(`[test-external] Trait externo detectado: ${traitId}`);
          } else {
            customTraits['SWAG'] = traitId.toString();
            console.log(`[test-external] Trait normal: ${traitId}`);
          }
        }
      });
    }

    console.log(`[test-external] Traits personalizados:`, customTraits);

    // Conectar con los contratos
    console.log('[test-external] Conectando con los contratos...');
    const { core, traitsExtension, serumModule } = await getContracts();

    // Obtener datos del token
    console.log('[test-external] Obteniendo datos del token...');
    const tokenData = await core.getTokenData(cleanTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    
    console.log('[test-external] TokenData:', {
      generation: generation.toString(),
      mutationLevel: mutationLevel.toString(),
      canReplicate,
      hasBeenModified
    });

    // Obtener skin del token
    console.log('[test-external] Obteniendo skin del token...');
    const tokenSkinData = await core.getTokenSkin(cleanTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    console.log('[test-external] Skin info:', {
      skinId,
      skinName
    });

    // Obtener traits equipados actuales
    console.log('[test-external] Obteniendo traits equipados actuales...');
    const nested = await traitsExtension.getAllEquippedTraits(cleanTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    // Crear mapa de traits actuales
    const currentTraits = {};
    categories.forEach((category, index) => {
      const normalizedCategory = normalizeCategory(category);
      const traitId = traitIds[index].toString();
      currentTraits[normalizedCategory] = traitId;
    });

    console.log('[test-external] Traits actuales:', currentTraits);

    // Aplicar traits personalizados
    const normalizedCustomTraits = {};
    Object.entries(customTraits).forEach(([category, traitId]) => {
      normalizedCustomTraits[normalizeCategory(category)] = traitId;
    });
    
    const finalTraits = { ...currentTraits, ...normalizedCustomTraits };
    console.log('[test-external] Traits finales (con modificaciones):', finalTraits);

    // LÓGICA ESPECIAL: Detectar serum aplicado y cambiar token base
    let baseTokenId = cleanTokenId;
    let appliedSerumForBase = null;
    
    try {
      console.log('[test-external] Verificando si hay serum aplicado para determinar token base...');
      const serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        const lastSerum = serumHistory[serumHistory.length - 1];
        const serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        if (serumSuccess && serumMutation === "AdrianGF") {
          appliedSerumForBase = serumMutation;
          baseTokenId = "146"; // Usar token 146 como base para ADRIANGF
          console.log(`[test-external] 🧬 LÓGICA TRAITLAB: Serum ADRIANGF detectado, cambiando token base de ${cleanTokenId} a ${baseTokenId}`);
        }
      }
    } catch (error) {
      console.log('[test-external] Error verificando serum para token base:', error.message);
    }
    
    console.log(`[test-external] Token base final: ${baseTokenId} (original: ${cleanTokenId})`);

    // Obtener skin del token base
    console.log('[test-external] Obteniendo skin del token base...');
    const tokenSkinDataBase = await core.getTokenSkin(baseTokenId);
    const skinIdBase = tokenSkinDataBase[0].toString();
    const skinNameBase = tokenSkinDataBase[1];
    
    console.log('[test-external] Skin info base:', {
      skinId: skinIdBase,
      skinName: skinNameBase
    });

    // Obtener traits equipados del token base
    console.log('[test-external] Obteniendo traits equipados del token base...');
    const nestedBase = await traitsExtension.getAllEquippedTraits(baseTokenId);
    const categoriesBase = nestedBase[0];
    const traitIdsBase = nestedBase[1];
    
    // Crear mapa de traits del token base
    const baseTraits = {};
    categoriesBase.forEach((category, index) => {
      const normalizedCategory = normalizeCategory(category);
      const traitId = traitIdsBase[index].toString();
      baseTraits[normalizedCategory] = traitId;
    });

    console.log('[test-external] Traits del token base:', baseTraits);

    // LÓGICA ESPECIAL: Si el token base no tiene traits, usar token 1 como fallback
    if (Object.keys(baseTraits).length === 0) {
      console.log('[test-external] Token base no tiene traits, usando token 1 como fallback...');
      const fallbackNested = await traitsExtension.getAllEquippedTraits("1");
      const fallbackCategories = fallbackNested[0];
      const fallbackTraitIds = fallbackNested[1];
      
      fallbackCategories.forEach((category, index) => {
        const normalizedCategory = normalizeCategory(category);
        const traitId = fallbackTraitIds[index].toString();
        baseTraits[normalizedCategory] = traitId;
      });
      
      console.log('[test-external] Traits del fallback (token 1):', baseTraits);
    }

    // Aplicar traits personalizados sobre los del token base
    const finalTraitsWithBase = { ...baseTraits, ...normalizedCustomTraits };
    console.log('[test-external] Traits finales (base + modificaciones):', finalTraitsWithBase);

    // Crear canvas
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1000, 1000);

    // Determinar imagen base
    const gen = generation.toString();
    let skinType;
    
    if (skinNameBase === "Zero" || skinIdBase === "0" || skinIdBase === "1") {
      skinType = "Medium";
    } else if (skinIdBase === "2" || skinNameBase === "Dark") {
      skinType = "Dark";
    } else if (skinIdBase === "3" || skinNameBase === "Alien") {
      skinType = "Alien";
    } else {
      skinType = skinNameBase || "Medium";
    }

    const baseImagePath = `ADRIAN/GEN${gen}-${skinType}.svg`;
    console.log('[test-external] Path de imagen base:', baseImagePath);

    // LÓGICA ESPECIAL: Detectar serum aplicado
    let appliedSerum = null;
    let serumSuccess = false;
    let hasSerumHistory = false;
    let serumFailed = false;
    try {
      console.log('[test-external] Verificando si hay serum aplicado...');
      const serumHistory = await serumModule.getTokenSerumHistory(cleanTokenId);
      
      if (serumHistory && serumHistory.length > 0) {
        hasSerumHistory = true;
        const lastSerum = serumHistory[serumHistory.length - 1];
        serumSuccess = lastSerum[1];
        const serumMutation = lastSerum[3];
        
        console.log(`[test-external] Historial de serum encontrado:`, {
          success: serumSuccess,
          mutation: serumMutation,
          hasBeenModified: hasBeenModified
        });
        
        if (serumSuccess) {
          if (serumMutation) {
            appliedSerum = serumMutation;
            console.log(`[test-external] Serum exitoso detectado: ${appliedSerum}`);
          } else {
            console.warn(`[test-external] Serum marcado como exitoso pero sin mutación, esto no debería pasar`);
          }
        } else {
          serumFailed = true;
          console.log(`[test-external] Serum fallido detectado: success = false (será "FAILED" en metadata)`);
        }
      }
    } catch (error) {
      console.log('[test-external] Error verificando serum aplicado:', error.message);
    }

    // 1. PRIMERO: Renderizar BACKGROUND si existe
    if (finalTraitsWithBase['BACKGROUND']) {
      const bgPath = `BACKGROUND/${finalTraitsWithBase['BACKGROUND']}.svg`;
      console.log(`[test-external] PASO 1 - Cargando background: ${bgPath}`);
      
      const bgImage = await loadAndRenderSvg(bgPath);
      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, 1000, 1000);
        console.log('[test-external] PASO 1 - Background renderizado correctamente');
      }
    }

    // 2. SEGUNDO: Renderizar el SKIN (Adrian base, excepción o serum)
    console.log('[test-external] PASO 2 - Iniciando carga del skin');
    
    // LÓGICA ESPECIAL: Si hay serum aplicado, usar el skin del serum
    if (appliedSerum) {
      console.log(`[test-external] PASO 2 - 🧬 LÓGICA ESPECIAL: Usando skin de serum aplicado: ${appliedSerum}, éxito: ${serumSuccess}`);
      
      // LÓGICA ESPECIAL PARA ADRIANGF: Manejar éxito y fallo
      if (appliedSerum === "AdrianGF") {
        if (serumSuccess) {
          // Serum exitoso: usar skin específico según GEN y tipo
          const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
          if (serumSkinImage) {
            ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
            console.log(`[test-external] PASO 2 - 🧬 Skin ADRIANGF exitoso (GEN${gen}, ${skinType}) renderizado correctamente`);
          } else {
            console.error(`[test-external] PASO 2 - Error al cargar skin ADRIANGF exitoso, usando skin base normal`);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              ctx.drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[test-external] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        } else {
          // Serum fallido: usar GF-Fail.svg
          console.log(`[test-external] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum ADRIANGF fallido, usando GF-Fail`);
          const failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
          try {
            const svgContent = fs.readFileSync(failPath, 'utf8');
            const resvg = new Resvg(svgContent, {
              fitTo: {
                mode: 'width',
                value: 1000
              }
            });
            const pngBuffer = resvg.render().asPng();
            const failImage = await loadImage(pngBuffer);
            ctx.drawImage(failImage, 0, 0, 1000, 1000);
            console.log('[test-external] PASO 2 - 🧬 Skin ADRIANGF fallido (GF-Fail) renderizado correctamente');
          } catch (error) {
            console.error(`[test-external] PASO 2 - Error al cargar GF-Fail, usando skin base normal:`, error.message);
            const baseImage = await loadAndRenderSvg(baseImagePath);
            if (baseImage) {
              ctx.drawImage(baseImage, 0, 0, 1000, 1000);
              console.log('[test-external] PASO 2 - Skin base renderizado correctamente (fallback)');
            }
          }
        }
      } else {
        // Otros serums: lógica original
        const serumSkinImage = await loadAdrianSvg(appliedSerum, gen, skinType);
        if (serumSkinImage) {
          ctx.drawImage(serumSkinImage, 0, 0, 1000, 1000);
          console.log(`[test-external] PASO 2 - 🧬 Skin de serum ${appliedSerum} renderizado correctamente`);
        } else {
          console.error(`[test-external] PASO 2 - Error al cargar skin de serum, usando skin base normal`);
          const baseImage = await loadAndRenderSvg(baseImagePath);
          if (baseImage) {
            ctx.drawImage(baseImage, 0, 0, 1000, 1000);
            console.log('[test-external] PASO 2 - Skin base renderizado correctamente (fallback)');
          }
        }
      }
    }
    // LÓGICA ESPECIAL: Si hay historial de serum pero no hay mutación (serum fallido)
    else if (serumFailed) {
      console.log(`[test-external] PASO 2 - 🧬 LÓGICA ESPECIAL: Serum fallido detectado, usando GF-Fail`);
      const failPath = path.join(process.cwd(), 'public', 'traits', 'ADRIANGF', 'GF-Fail.svg');
      try {
        const svgContent = fs.readFileSync(failPath, 'utf8');
        const resvg = new Resvg(svgContent, {
          fitTo: {
            mode: 'width',
            value: 1000
          }
        });
        const pngBuffer = resvg.render().asPng();
        const failImage = await loadImage(pngBuffer);
        ctx.drawImage(failImage, 0, 0, 1000, 1000);
        console.log('[test-external] PASO 2 - 🧬 Skin ADRIANGF fallido (GF-Fail) renderizado correctamente');
      } catch (error) {
        console.error(`[test-external] PASO 2 - Error al cargar GF-Fail, usando skin base normal:`, error.message);
        const baseImage = await loadAndRenderSvg(baseImagePath);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, 1000, 1000);
          console.log('[test-external] PASO 2 - Skin base renderizado correctamente (fallback)');
        }
      }
    } else {
      // Usar skin base normal
      console.log('[test-external] PASO 2 - Usando skin base normal');
      const baseImage = await loadAndRenderSvg(baseImagePath);
      if (baseImage) {
        ctx.drawImage(baseImage, 0, 0, 1000, 1000);
        console.log('[test-external] PASO 2 - Skin base renderizado correctamente');
      } else {
        console.error('[test-external] PASO 2 - Error al cargar el skin, intentando fallback');
        const fallbackPath = `ADRIAN/GEN${gen}-Medium.svg`;
        const fallbackImage = await loadAndRenderSvg(fallbackPath);
        if (fallbackImage) {
          ctx.drawImage(fallbackImage, 0, 0, 1000, 1000);
          console.log('[test-external] PASO 2 - Skin fallback renderizado correctamente');
        }
      }
    }

    // 2.5. RENDERIZAR SKIN TRAITS ESPECIALES (tokens 37, 38) encima del skin base
    console.log('[test-external] PASO 2.5 - Renderizando skin traits especiales');
    if (finalTraitsWithBase['SWAG'] === '37' || finalTraitsWithBase['SWAG'] === '38') {
      const skinTraitId = finalTraitsWithBase['SWAG'];
      const skinTraitPath = `SKIN/${skinTraitId}.svg`;
      console.log(`[test-external] PASO 2.5 - Renderizando skin trait especial: ${skinTraitPath}`);
      
      const skinTraitImage = await loadAndRenderSvg(skinTraitPath);
      if (skinTraitImage) {
        ctx.drawImage(skinTraitImage, 0, 0, 1000, 1000);
        console.log(`[test-external] PASO 2.5 - Skin trait especial ${skinTraitId} renderizado correctamente`);
      }
    }

    // 3. TERCERO: Renderizar resto de traits
    console.log('[test-external] PASO 3 - Iniciando renderizado de traits adicionales');
    const traitOrder = ['BEARD', 'EAR', 'GEAR', 'RANDOMSHIT', 'HAT', 'SWAG', 'HAIR', 'HEAD', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];

    for (const category of traitOrder) {
      if (finalTraitsWithBase[category]) {
        // LÓGICA ESPECIAL: No renderizar HAIR 21 si HEAD 209 está activo
        if (category === 'HAIR' && finalTraitsWithBase['HAIR'] === '21' && finalTraitsWithBase['HEAD'] === '209') {
          console.log('[test-external] LÓGICA ESPECIAL: No renderizar HAIR 21 porque HEAD 209 está activo');
          continue;
        }
        // Solo para traits visuales normales (no ADRIAN ni ADRIANGF)
        if (category !== 'ADRIAN' && category !== 'ADRIANGF') {
          const traitId = finalTraitsWithBase[category];
          const traitImage = await loadTraitFromLabimages(traitId);
          if (traitImage) {
            ctx.drawImage(traitImage, 0, 0, 1000, 1000);
            console.log(`[test-external] PASO 3 - Trait ${category} (${traitId}) renderizado desde labimages correctamente`);
          } else {
            console.error(`[test-external] PASO 3 - Error al cargar trait ${category} (${traitId}) desde labimages`);
          }
        }
      }
    }

    // 4. CUARTO: Renderizar trait externo (TEST) - va encima de todos los traits normales
    if (finalTraitsWithBase['EXTERNAL_TEST']) {
      console.log('[test-external] PASO 4 - Renderizando trait externo de test');
      const externalImage = await loadExternalSvg('https://adrianzero.com/designs/30004.svg');
      if (externalImage) {
        ctx.drawImage(externalImage, 0, 0, 1000, 1000);
        console.log('[test-external] PASO 4 - Trait externo renderizado correctamente');
      } else {
        console.error('[test-external] PASO 4 - Error al cargar trait externo');
      }
    }

    // 5. QUINTO: Renderizar TOP layers (van encima de todas las demás)
    console.log('[test-external] PASO 5 - Renderizando TOP layers');
    const topOrder = ['TOP'];

    for (const category of topOrder) {
      if (finalTraitsWithBase[category]) {
        const traitId = finalTraitsWithBase[category];
        console.log(`[test-external] PASO 5 - Cargando TOP trait: ${traitId}`);

        const traitImage = await loadTraitFromLabimages(traitId);
        if (traitImage) {
          ctx.drawImage(traitImage, 0, 0, 1000, 1000);
          console.log(`[test-external] PASO 5 - TOP trait ${category} (${traitId}) renderizado desde labimages correctamente`);
        } else {
          console.error(`[test-external] PASO 5 - Error al cargar TOP trait ${category} (${traitId}) desde labimages`);
        }
      }
    }

    // LÓGICA ESPECIAL: Renderizar token 48 (S.W.A.T-Shild) en TOP
    if (finalTraitsWithBase['GEAR'] === '48') {
      const specialTraitPath = `GEAR/48.svg`;
      console.log(`[test-external] PASO 5 - 🎯 LÓGICA ESPECIAL: Renderizando token 48 en TOP: ${specialTraitPath}`);

      const specialTraitImage = await loadAndRenderSvg(specialTraitPath);
      if (specialTraitImage) {
        ctx.drawImage(specialTraitImage, 0, 0, 1000, 1000);
        console.log(`[test-external] PASO 5 - 🎯 Token 48 renderizado correctamente en TOP`);
      }
    }

    // Configurar headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Enviar imagen
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

    console.log('[test-external] Test de renderizado externo completado exitosamente');

  } catch (error) {
    console.error('[test-external] Error general:', error);
    console.error('[test-external] Stack trace:', error.stack);
    
    // En caso de error, devolver una imagen de error
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Fondo gris
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Texto de error
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error Test External Render', 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText(`Token #${req.query.tokenId?.replace('.png', '') || 'Unknown'}`, 500, 500);
    ctx.font = '18px Arial';
    ctx.fillText(error.message.substring(0, 50), 500, 550);
    
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
} 
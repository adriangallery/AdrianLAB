import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import crypto from 'crypto';

// Caché en memoria para PNGs renderizados (evita reprocesar SVGs grandes)
const pngCache = new Map();
const MAX_CACHE_SIZE = 50; // Máximo 50 imágenes en caché
const MAX_SVG_SIZE_MB = 100; // Límite de 100MB para SVGs

// Función para generar hash de URL para usar como clave de caché
function getCacheKey(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

// Función para limpiar caché si está lleno (FIFO)
function cleanupCache() {
  if (pngCache.size >= MAX_CACHE_SIZE) {
    const firstKey = pngCache.keys().next().value;
    pngCache.delete(firstKey);
    console.log(`[renderer] 🗑️  Limpiando caché (eliminado: ${firstKey.substring(0, 8)}...)`);
  }
}

// Función para cargar SVG desde URL y convertirlo a imagen
async function loadSvgAsImage(url) {
  const cacheKey = getCacheKey(url);
  
  // Verificar caché primero
  if (pngCache.has(cacheKey)) {
    console.log(`[renderer] 💾 Usando imagen desde caché para: ${url.substring(url.length - 30)}`);
    const cachedPng = pngCache.get(cacheKey);
    try {
      const image = await loadImage(cachedPng);
      return image;
    } catch (error) {
      console.error(`[renderer] ⚠️  Error cargando imagen desde caché, regenerando...`, error.message);
      pngCache.delete(cacheKey);
    }
  }
  
  try {
    console.log(`[renderer] 📥 Iniciando carga de SVG desde: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // Verificar tamaño del contenido antes de descargar completamente
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeMB = parseInt(contentLength) / 1024 / 1024;
      if (sizeMB > MAX_SVG_SIZE_MB) {
        throw new Error(`SVG demasiado grande: ${sizeMB.toFixed(2)} MB (límite: ${MAX_SVG_SIZE_MB} MB)`);
      }
      console.log(`[renderer] 📥 Tamaño esperado del SVG: ${sizeMB.toFixed(2)} MB`);
    }
    
    console.log(`[renderer] 📥 SVG descargado, convirtiendo a buffer...`);
    const svgBuffer = await response.arrayBuffer();
    const svgSize = svgBuffer.byteLength;
    const svgSizeMB = svgSize / 1024 / 1024;
    console.log(`[renderer] 📥 Tamaño real del SVG: ${svgSizeMB.toFixed(2)} MB`);
    
    if (svgSizeMB > MAX_SVG_SIZE_MB) {
      throw new Error(`SVG demasiado grande: ${svgSizeMB.toFixed(2)} MB (límite: ${MAX_SVG_SIZE_MB} MB)`);
    }
    
    const svgContent = Buffer.from(svgBuffer);
    
    console.log(`[renderer] 📥 Iniciando conversión SVG→PNG con Resvg...`);
    // Convertir SVG a PNG con configuración optimizada
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: 1000
      },
      // Optimizaciones para archivos grandes
      font: {
        loadSystemFonts: false // No cargar fuentes del sistema para ahorrar memoria
      }
    });
    
    console.log(`[renderer] 📥 Renderizando PNG...`);
    const pngBuffer = resvg.render().asPng();
    console.log(`[renderer] 📥 PNG renderizado, tamaño: ${(pngBuffer.length / 1024).toFixed(2)} KB`);
    
    // Guardar en caché antes de cargar la imagen
    cleanupCache();
    pngCache.set(cacheKey, pngBuffer);
    console.log(`[renderer] 💾 PNG guardado en caché (${pngCache.size}/${MAX_CACHE_SIZE})`);
    
    console.log(`[renderer] 📥 Cargando imagen en canvas...`);
    const image = await loadImage(pngBuffer);
    console.log(`[renderer] ✅ Imagen cargada exitosamente desde ${url}`);
    return image;
  } catch (error) {
    console.error(`[renderer] ❌ Error cargando SVG desde ${url}:`, error.message);
    if (error.stack) {
      console.error(`[renderer] Stack:`, error.stack);
    }
    return null;
  }
}

// Función para cargar trait desde labimages
async function loadTraitFromLabimages(traitId, baseUrl) {
  const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
  return await loadSvgAsImage(imageUrl);
}

// Función para cargar trait externo (30000-35000)
async function loadExternalTrait(traitId) {
  const externalUrl = `https://adrianzero.com/designs/${traitId}.svg`;
  return await loadSvgAsImage(externalUrl);
}

// Función para cargar trait OGPUNK (100001-101003)
async function loadOgpunkTrait(traitId, baseUrl) {
  const imageUrl = `${baseUrl}/labimages/ogpunks/${traitId}.svg`;
  return await loadSvgAsImage(imageUrl);
}

// Función para cargar desde traits/ path
async function loadFromTraitsPath(path, baseUrl) {
  const imageUrl = `${baseUrl}/traits/${path}`;
  return await loadSvgAsImage(imageUrl);
}

// Función principal de renderizado
export async function renderImage(payload, baseUrl) {
  const {
    tokenId,
    generation,
    skinType,
    finalTraits,
    appliedSerum,
    serumSuccess,
    hasAdrianGFSerum,
    serumHistory,
    failedSerumType,
    baseImagePath,
    skintraitPath,
    skinTraitPath,
    isCloseup,
    traitsMapping
  } = payload;

  console.log(`[renderer] 🎨 Iniciando renderizado para token ${tokenId}`);
  console.log(`[renderer] 📋 finalTraits recibidos:`, JSON.stringify(finalTraits, null, 2));
  console.log(`[renderer] 📋 BACKGROUND en finalTraits:`, finalTraits && finalTraits['BACKGROUND'] ? finalTraits['BACKGROUND'] : 'NO HAY');

  // Crear canvas con fondo blanco
  const canvas = createCanvas(1000, 1000);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1000, 1000);

  const gen = generation.toString();

  // 1. Renderizar BACKGROUND si existe
  if (finalTraits && finalTraits['BACKGROUND']) {
    const bgTraitId = finalTraits['BACKGROUND'];
    console.log(`[renderer] PASO 1 - Cargando background con traitId: ${bgTraitId}`);
    
    try {
      // Los backgrounds están en labimages/{traitId}.svg, no en traits/BACKGROUND/
      // Intentar primero desde labimages (ubicación real)
      console.log(`[renderer] PASO 1 - Intentando cargar desde labimages/${bgTraitId}.svg...`);
      let bgImage = await loadTraitFromLabimages(bgTraitId, baseUrl);
      
      // Fallback: si no se encuentra en labimages, intentar en traits/BACKGROUND
      if (!bgImage) {
        const bgPath = `BACKGROUND/${bgTraitId}.svg`;
        console.log(`[renderer] ⚠️  Background no encontrado en labimages, intentando fallback en traits/${bgPath}`);
        bgImage = await loadFromTraitsPath(bgPath, baseUrl);
      }
      
      if (bgImage) {
        console.log(`[renderer] PASO 1 - Dibujando background en canvas...`);
        ctx.drawImage(bgImage, 0, 0, 1000, 1000);
        console.log('[renderer] ✅ PASO 1 - Background renderizado exitosamente');
      } else {
        console.error(`[renderer] ❌ ERROR: No se pudo cargar el background desde labimages/${bgTraitId}.svg ni desde traits/BACKGROUND/${bgTraitId}.svg`);
      }
    } catch (error) {
      console.error(`[renderer] ❌ ERROR CRÍTICO cargando background:`, error.message);
      if (error.stack) {
        console.error(`[renderer] Stack:`, error.stack);
      }
      // Continuar sin background en lugar de fallar completamente
    }
  } else {
    console.log(`[renderer] ⚠️  No hay BACKGROUND en finalTraits o finalTraits es null/undefined`);
  }

  // 2. Renderizar SKIN
  console.log('[renderer] PASO 2 - Iniciando carga del skin');
  
  // SKINTRAIT tiene máxima prioridad
  // Construir skintraitPath si no está presente pero hay SKINTRAIT en finalTraits
  let effectiveSkintraitPath = skintraitPath;
  if (!effectiveSkintraitPath && finalTraits && finalTraits['SKINTRAIT']) {
    effectiveSkintraitPath = `SKINTRAIT/${finalTraits['SKINTRAIT']}.svg`;
    console.log(`[renderer] PASO 2 - Construyendo skintraitPath desde finalTraits['SKINTRAIT']: ${effectiveSkintraitPath}`);
  }
  
  if (effectiveSkintraitPath) {
    console.log(`[renderer] PASO 2 - 🎨 SKINTRAIT: ${effectiveSkintraitPath}`);
    const skintraitImage = await loadFromTraitsPath(effectiveSkintraitPath, baseUrl);
    if (skintraitImage) {
      ctx.drawImage(skintraitImage, 0, 0, 1000, 1000);
      console.log(`[renderer] PASO 2 - 🎨 SKINTRAIT renderizado correctamente`);
    } else {
      console.error(`[renderer] PASO 2 - ❌ Error al cargar SKINTRAIT desde ${effectiveSkintraitPath}`);
    }
  }
  // Serum aplicado
  else if (appliedSerum) {
    if (appliedSerum === "GoldenAdrian") {
      if (serumSuccess) {
        const serumPath = `ADRIAN/GEN${gen}-Golden.svg`;
        const serumImage = await loadFromTraitsPath(serumPath, baseUrl);
        if (serumImage) {
          ctx.drawImage(serumImage, 0, 0, 1000, 1000);
        }
      } else {
        // GoldenAdrian fallido
        const failPath = hasAdrianGFSerum 
          ? 'ADRIANGF/GF-Goldfail.svg'
          : `ADRIAN/GEN${gen}-Goldenfail.svg`;
        const failImage = await loadFromTraitsPath(failPath, baseUrl);
        if (failImage) {
          ctx.drawImage(failImage, 0, 0, 1000, 1000);
        }
      }
    } else if (appliedSerum === "AdrianGF") {
      if (serumSuccess) {
        // Lógica compleja de conversión simplificada
        let convertedHandled = false;
        if (serumHistory && serumHistory.length > 0) {
          for (let i = serumHistory.length - 2; i >= 0; i--) {
            const ev = serumHistory[i];
            if (ev && ev[3] === 'GoldenAdrian') {
              if (ev[1] === false) {
                const failPath = 'ADRIANGF/GF-Goldfail.svg';
                const failImage = await loadFromTraitsPath(failPath, baseUrl);
                if (failImage) {
                  ctx.drawImage(failImage, 0, 0, 1000, 1000);
                  convertedHandled = true;
                }
              } else if (ev[1] === true) {
                const serumPath = `ADRIANGF/GF${gen}/GF${gen}_Golden.svg`;
                const serumImage = await loadFromTraitsPath(serumPath, baseUrl);
                if (serumImage) {
                  ctx.drawImage(serumImage, 0, 0, 1000, 1000);
                  convertedHandled = true;
                }
              }
              break;
            }
          }
        }
        if (!convertedHandled) {
          // GF normal según skinType
          let gfPath;
          if (skinType === "Albino") {
            gfPath = `ADRIANGF/GF${gen}/GEN${gen}_Albino.svg`;
          } else if (skinType === "Alien") {
            gfPath = `ADRIANGF/GF${gen}/GF${gen}_Alien.svg`;
          } else if (skinType === "Golden") {
            gfPath = `ADRIANGF/GF${gen}/GF${gen}_Golden.svg`;
          } else {
            gfPath = `ADRIANGF/GF${gen}/GF${gen}-${skinType}.svg`;
          }
          const serumImage = await loadFromTraitsPath(gfPath, baseUrl);
          if (serumImage) {
            ctx.drawImage(serumImage, 0, 0, 1000, 1000);
          }
        }
      } else {
        // AdrianGF fallido
        const failPath = 'ADRIANGF/GF-Fail.svg';
        const failImage = await loadFromTraitsPath(failPath, baseUrl);
        if (failImage) {
          ctx.drawImage(failImage, 0, 0, 1000, 1000);
        }
      }
    } else {
      // Otros serums
      const serumPath = `ADRIAN/${appliedSerum.toUpperCase()}.svg`;
      const serumImage = await loadFromTraitsPath(serumPath, baseUrl);
      if (serumImage) {
        ctx.drawImage(serumImage, 0, 0, 1000, 1000);
      }
    }
  }
  // Serum fallido
  else if (failedSerumType) {
    let failPath;
    if (failedSerumType === "AdrianGF") {
      failPath = 'ADRIANGF/GF-Fail.svg';
    } else if (failedSerumType === "GoldenAdrian") {
      failPath = hasAdrianGFSerum 
        ? 'ADRIANGF/GF-Goldfail.svg'
        : `ADRIAN/GEN${gen}-Goldenfail.svg`;
    } else {
      failPath = 'ADRIANGF/GF-Fail.svg';
    }
    const failImage = await loadFromTraitsPath(failPath, baseUrl);
    if (failImage) {
      ctx.drawImage(failImage, 0, 0, 1000, 1000);
    }
  }
  // Skin excepcional
  else if (skinTraitPath) {
    const skinImage = await loadFromTraitsPath(skinTraitPath, baseUrl);
    if (skinImage) {
      ctx.drawImage(skinImage, 0, 0, 1000, 1000);
    }
  }
  // Skin base normal
  else if (baseImagePath) {
    const baseImage = await loadFromTraitsPath(baseImagePath, baseUrl);
    if (baseImage) {
      ctx.drawImage(baseImage, 0, 0, 1000, 1000);
    }
  }

  // 2.5. Skin traits especiales (37, 38)
  if (finalTraits && (finalTraits['SWAG'] === '37' || finalTraits['SWAG'] === '38')) {
    const skinTraitId = finalTraits['SWAG'];
    const skinTraitPath = `SKIN/${skinTraitId}.svg`;
    const skinTraitImage = await loadFromTraitsPath(skinTraitPath, baseUrl);
    if (skinTraitImage) {
      ctx.drawImage(skinTraitImage, 0, 0, 1000, 1000);
    }
  }

  // 3. Renderizar resto de traits
  console.log('[renderer] PASO 3 - Renderizando traits adicionales');
  
  // GEAR 721 y 726 antes de SWAG
  if (finalTraits && (finalTraits['GEAR'] === '721' || finalTraits['GEAR'] === '726')) {
    const gearTraitId = finalTraits['GEAR'];
    let gearImage = await loadTraitFromLabimages(gearTraitId, baseUrl);
    if (gearImage) {
      ctx.drawImage(gearImage, 0, 0, 1000, 1000);
    }
  }
  
  const traitOrder = ['BEARD', 'EAR', 'RANDOMSHIT', 'SWAG', 'GEAR', 'HAIR', 'HAT', 'HEAD', 'SKIN', 'SERUMS', 'EYES', 'MOUTH', 'NECK', 'NOSE', 'FLOPPY DISCS', 'PAGERS'];
  
  for (const category of traitOrder) {
    if (finalTraits && finalTraits[category]) {
      // Lógica especial: HAIR 21 si HEAD 209
      if (category === 'HAIR' && finalTraits['HAIR'] === '21' && finalTraits['HEAD'] === '209') {
        continue;
      }
      // Saltar GEAR 721 y 726 si ya se renderizaron
      if (category === 'GEAR' && (finalTraits['GEAR'] === '721' || finalTraits['GEAR'] === '726')) {
        continue;
      }
      // SERUMS solo si NO hay EYES
      if (category === 'SERUMS') {
        const eyesTrait = finalTraits['EYES'];
        if (eyesTrait && eyesTrait !== 'None' && eyesTrait !== '') {
          continue;
        }
      }
      
      const traitId = finalTraits[category];
      let traitImage = null;
      
      // Determinar fuente del trait
      if (traitsMapping && traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
        traitImage = await loadExternalTrait(traitId);
      } else if (traitId >= 100001 && traitId <= 101003) {
        traitImage = await loadOgpunkTrait(traitId, baseUrl);
      } else {
        traitImage = await loadTraitFromLabimages(traitId, baseUrl);
      }
      
      if (traitImage) {
        ctx.drawImage(traitImage, 0, 0, 1000, 1000);
      }
    }
  }

  // 4. Renderizar TOP layers
  console.log('[renderer] PASO 4 - Renderizando TOP layers');
  if (finalTraits && finalTraits['TOP']) {
    const traitId = finalTraits['TOP'];
    
    // Lógica especial: CAESAR (101003) es GIF, pero aquí solo manejamos PNG
    let traitImage = null;
    if (traitsMapping && traitsMapping[traitId] && traitsMapping[traitId].isExternal) {
      traitImage = await loadExternalTrait(traitId);
    } else if (traitId >= 100001 && traitId <= 101003) {
      traitImage = await loadOgpunkTrait(traitId, baseUrl);
    } else {
      traitImage = await loadTraitFromLabimages(traitId, baseUrl);
    }
    
    if (traitImage) {
      ctx.drawImage(traitImage, 0, 0, 1000, 1000);
    }
  }

  // GEAR 48 en TOP
  if (finalTraits && finalTraits['GEAR'] === '48') {
    const specialTraitPath = 'GEAR/48.svg';
    const specialTraitImage = await loadFromTraitsPath(specialTraitPath, baseUrl);
    if (specialTraitImage) {
      ctx.drawImage(specialTraitImage, 0, 0, 1000, 1000);
    }
  }

  // Aplicar closeup si es necesario
  let finalBuffer;
  if (isCloseup) {
    console.log(`[renderer] Aplicando closeup 640x640`);
    const closeupCanvas = createCanvas(640, 640);
    const closeupCtx = closeupCanvas.getContext('2d');
    const cropX = 200;
    const cropY = 85;
    const cropSize = 640;
    closeupCtx.drawImage(
      canvas,
      cropX, cropY, cropSize, cropSize,
      0, 0, 640, 640
    );
    finalBuffer = closeupCanvas.toBuffer('image/png');
  } else {
    finalBuffer = canvas.toBuffer('image/png');
  }

  console.log(`[renderer] ✅ Renderizado completado, tamaño: ${finalBuffer.length} bytes`);
  return finalBuffer;
}


import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';

// Función para cargar SVG desde URL y convertirlo a imagen
async function loadSvgAsImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    const svgContent = Buffer.from(svgBuffer);
    
    // Convertir SVG a PNG
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: 1000
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    return await loadImage(pngBuffer);
  } catch (error) {
    console.error(`[renderer] Error cargando SVG desde ${url}:`, error.message);
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
    
    // Los backgrounds están en labimages/{traitId}.svg, no en traits/BACKGROUND/
    // Intentar primero desde labimages (ubicación real)
    let bgImage = await loadTraitFromLabimages(bgTraitId, baseUrl);
    
    // Fallback: si no se encuentra en labimages, intentar en traits/BACKGROUND
    if (!bgImage) {
      const bgPath = `BACKGROUND/${bgTraitId}.svg`;
      console.log(`[renderer] ⚠️  Background no encontrado en labimages, intentando fallback en traits/${bgPath}`);
      bgImage = await loadFromTraitsPath(bgPath, baseUrl);
    }
    
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, 1000, 1000);
      console.log('[renderer] PASO 1 - Background renderizado');
    } else {
      console.error(`[renderer] ❌ ERROR: No se pudo cargar el background desde labimages/${bgTraitId}.svg ni desde traits/BACKGROUND/${bgTraitId}.svg`);
    }
  } else {
    console.log(`[renderer] ⚠️  No hay BACKGROUND en finalTraits o finalTraits es null/undefined`);
  }

  // 2. Renderizar SKIN
  console.log('[renderer] PASO 2 - Iniciando carga del skin');
  
  // SKINTRAIT tiene máxima prioridad
  if (skintraitPath) {
    console.log(`[renderer] PASO 2 - SKINTRAIT: ${skintraitPath}`);
    const skintraitImage = await loadFromTraitsPath(skintraitPath, baseUrl);
    if (skintraitImage) {
      ctx.drawImage(skintraitImage, 0, 0, 1000, 1000);
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


import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';
import { createCanvas } from 'canvas';
import { textToSVGElement, linesToSVG } from '../../../../lib/text-to-svg.js';
import { getContracts } from '../../../../lib/contracts.js';
import { 
  getCachedFloppyRender, 
  setCachedFloppyRender, 
  getFloppyRenderTTL 
} from '../../../../lib/cache.js';

// Cache para traits animados
const animatedTraitsCache = new Map();

// Función para detectar si un SVG es animado
const detectSvgAnimation = (svgContent) => {
  const animationPatterns = [
    '<animate', '<animateTransform', '<animateMotion',
    '@keyframes', 'animation:', 'transition:', 'dur=', 'repeatCount='
  ];
  
  return animationPatterns.some(pattern => svgContent.includes(pattern));
};

// Función para cargar SVG y detectar animación (usando fetch HTTP como el render personalizado)
const loadAndDetectAnimation = async (svgFileName) => {
  try {
    // Usar fetch HTTP como el render personalizado para mayor tolerancia
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/labimages/${svgFileName}`;
    console.log(`[loadAndDetectAnimation] Cargando SVG desde URL: ${imageUrl}`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    const svgContent = Buffer.from(svgBuffer).toString();
    const isAnimated = detectSvgAnimation(svgContent);
    
    console.log(`[loadAndDetectAnimation] SVG cargado, tamaño: ${svgBuffer.byteLength} bytes, animado: ${isAnimated}`);
    
    return {
      content: svgContent,
      isAnimated: isAnimated
    };
  } catch (error) {
    console.error(`Error cargando SVG ${svgFileName}:`, error.message);
    return { content: null, isAnimated: false };
  }
};

// Función principal de detección híbrida
const isTraitAnimated = async (traitData, traitPath) => {
  // Prioridad 1: Metadata en traits.json
  if (traitData && traitData.animated !== undefined) {
    return traitData.animated;
  }
  
  // Prioridad 2: Cache
  if (animatedTraitsCache.has(traitPath)) {
    return animatedTraitsCache.get(traitPath);
  }
  
  // Prioridad 3: Detección dinámica
  try {
    const svgData = await loadAndDetectAnimation(traitPath);
    animatedTraitsCache.set(traitPath, svgData.isAnimated);
    return svgData.isAnimated;
  } catch (error) {
    console.warn(`No se pudo detectar animación para ${traitPath}:`, error);
    return false;
  }
};

// Función para generar GIF animado (placeholder)
const generateAnimatedGif = async (tokenData, traitSvgContent) => {
  // Por ahora, generamos un PNG con indicador de animación
  // En el futuro, aquí iría la lógica de generación de GIF
  console.log('[floppy-render] Generando GIF animado para trait animado');
  
  try {
    // Crear canvas con fondo blanco
    const canvas = createCanvas(768, 1024);
    const ctx = canvas.getContext('2d');
    
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 768, 1024);
    
    // Añadir indicador de animación
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ANIMATED TRAIT DETECTED', 384, 512);
    ctx.fillText('GIF generation coming soon', 384, 562);
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('[floppy-render] Error generando imagen animada:', error);
    // Fallback: crear una imagen simple de error
    const canvas = createCanvas(768, 1024);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 768, 1024);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ANIMATION ERROR', 384, 512);
    return canvas.toBuffer('image/png');
  }
};

// Función para normalizar categorías a mayúsculas
const normalizeCategory = (category) => {
  // Todas las categorías ya están en mayúsculas en traits.json
  // Solo mantener el mapeo PACKS->SWAG para compatibilidad con el contrato
  const categoryMap = {
    'PACKS': 'SWAG'  // Mapear PACKS a SWAG (discrepancia del contrato)
  };
  
  return categoryMap[category] || category;
};

// NUEVAS FUNCIONES: Método personalizado para renderizado individual (como test-simple)
const loadTraitFromLabimages = async (traitId) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/labimages/${traitId}.svg`;
    console.log(`[floppy-render] Cargando trait desde labimages: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    console.log(`[floppy-render] SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
    
    // Renderizar SVG a PNG PRIMERO (mismo método que render personalizado)
    const resvg = new Resvg(Buffer.from(svgBuffer), {
      fitTo: {
        mode: 'width',
        value: 600  // Tamaño para el contenedor
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    console.log(`[floppy-render] Trait renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
    
    // Convertir a base64 para usar en <image>
    const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    return base64Image;
  } catch (error) {
    console.error(`[floppy-render] Error cargando trait ${traitId} desde labimages:`, error.message);
    return null;
  }
};

const loadMannequinFromLabimages = async () => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/labimages/mannequin.svg`;
    console.log(`[floppy-render] Cargando mannequin desde labimages: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const svgBuffer = await response.arrayBuffer();
    console.log(`[floppy-render] Mannequin SVG cargado, tamaño: ${svgBuffer.byteLength} bytes`);
    
    // Renderizar SVG a PNG PRIMERO
    const resvg = new Resvg(Buffer.from(svgBuffer), {
      fitTo: {
        mode: 'width',
        value: 600  // Tamaño para el contenedor
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    console.log(`[floppy-render] Mannequin renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);
    
    // Convertir a base64 para usar en <image>
    const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    return base64Image;
  } catch (error) {
    console.error(`[floppy-render] Error cargando mannequin desde labimages:`, error.message);
    return null;
  }
};

export default async function handler(req, res) {
  // Configurar CORS - Permitir múltiples orígenes
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com',
    'https://opensea.io',
    'https://testnets.opensea.io',
    'https://rarible.com',
    'https://looksrare.org',
    'https://x2y2.io',
    'https://blur.io',
    'https://magiceden.io',
    'https://sudoswap.xyz',
    'https://reservoir.tools',
    'https://nftx.io',
    'https://element.market',
    'https://tensor.trade',
    'https://okx.com',
    'https://binance.com',
    'https://coinbase.com'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Para requests sin origin (como imágenes directas) o orígenes no listados
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(tokenId);

    // ===== SISTEMA DE CACHÉ PARA FLOPPY RENDER =====
    const cachedImage = getCachedFloppyRender(tokenIdNum);
    
    if (cachedImage) {
      console.log(`[floppy-render] 🎯 CACHE HIT para token ${tokenIdNum}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Version', 'FLOPPY-METODO-PERSONALIZADO');
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[floppy-render] 💾 CACHE MISS para token ${tokenIdNum} - Generando imagen...`);
    console.log(`[floppy-render] ===== RENDERIZADO TRAITS (1-9999) =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);

    // Procesar tokens 1-9999 (traits) y 262144 (serum ADRIANGF)
    if (tokenIdNum >= 1 && tokenIdNum <= 9999 || tokenIdNum === 262144) {
      console.log(`[floppy-render] Procesando trait ${tokenId} (renderizado PNG)`);
      await handleRenderToken(req, res, tokenId);
    } else {
      res.status(400).json({ error: 'Este endpoint solo maneja tokens 1-9999 (traits) y 262144 (serums). Para tokens 10000+ usa /api/metadata/floppy/[tokenId]' });
    }
  } catch (error) {
    console.error('[floppy-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// FUNCIÓN PARA TOKENS 1-9999 Y 262144 (SVG COMPLETO CON TEXTO CONVERTIDO A PATHS)
async function handleRenderToken(req, res, tokenId) {
  const tokenIdNum = parseInt(tokenId);
  let traitData;
  
  // Conectar con los contratos para obtener datos onchain
  console.log('[floppy-render] Conectando con los contratos...');
  const { traitsCore } = await getContracts();
  
  // Determinar qué archivo cargar según el token ID
  if (tokenIdNum === 262144) {
    // Cargar datos de serums.json para token 262144
    const serumsPath = path.join(process.cwd(), 'public', 'labmetadata', 'serums.json');
    let serumsData;
    
    try {
      const serumsBuffer = fs.readFileSync(serumsPath);
      serumsData = JSON.parse(serumsBuffer.toString());
      console.log(`[floppy-render] Serums data cargado, ${serumsData.serums.length} serums encontrados`);
    } catch (error) {
      console.error('[floppy-render] Error cargando serums data:', error);
      return res.status(500).json({ error: 'Error cargando datos de serums' });
    }

    // Buscar el serum correspondiente al tokenId
    traitData = serumsData.serums.find(serum => serum.tokenId === tokenIdNum);
  } else {
    // Cargar datos de labmetadata para tokens 1-9999
    const labmetadataPath = path.join(process.cwd(), 'public', 'labmetadata', 'traits.json');
    let labmetadata;
    
    try {
      const labmetadataBuffer = fs.readFileSync(labmetadataPath);
      labmetadata = JSON.parse(labmetadataBuffer.toString());
      console.log(`[floppy-render] Labmetadata cargado, ${labmetadata.traits.length} traits encontrados`);
    } catch (error) {
      console.error('[floppy-render] Error cargando labmetadata:', error);
      return res.status(500).json({ error: 'Error cargando datos de traits' });
    }

    // Buscar el trait correspondiente al tokenId
    traitData = labmetadata.traits.find(trait => trait.tokenId === tokenIdNum);
  }
  
  if (!traitData) {
    console.log(`[floppy-render] Trait no encontrado para tokenId ${tokenId}, usando datos genéricos`);
    // Datos genéricos si no se encuentra el trait
    const tokenData = {
      name: `TRAIT #${tokenId}`,
      category: "UNKNOWN",
      maxSupply: 300
    };
  } else {
    console.log(`[floppy-render] Trait encontrado:`, JSON.stringify(traitData, null, 2));
  }

  // Usar los datos del trait encontrado o datos genéricos
  const tokenData = traitData || {
    name: `TRAIT #${tokenId}`,
    category: "UNKNOWN",
    maxSupply: 300
  };

  console.log(`[floppy-render] Datos del token:`, JSON.stringify(tokenData, null, 2));

  // Obtener datos onchain para calcular total minted
  let totalMinted = 0;
  try {
    console.log(`[floppy-render] Obteniendo totalMintedPerAsset para trait ${tokenId}...`);
    const mintedAmount = await traitsCore.totalMintedPerAsset(tokenId);
    console.log(`[floppy-render] TotalMintedPerAsset obtenido: ${mintedAmount.toString()}`);
    
    // Usar directamente el valor obtenido del contrato
    totalMinted = mintedAmount.toNumber();
    console.log(`[floppy-render] Total minted obtenido del contrato: ${totalMinted}`);
  } catch (error) {
    console.error(`[floppy-render] Error obteniendo totalMintedPerAsset:`, error.message);
    // Fallback: usar maxSupply como total minted si falla la llamada onchain
    totalMinted = tokenData.maxSupply;
    console.log(`[floppy-render] Usando fallback: totalMinted = maxSupply = ${totalMinted}`);
  }

  // Función para obtener tag y color según maxSupply (niveles actualizados)
  function getRarityTagAndColor(maxSupply) {
    if (maxSupply === 1) return { tag: 'UNIQUE', bg: '#ff0000' };        // Rojo
    if (maxSupply <= 6) return { tag: 'LEGENDARY', bg: '#ffd700' };      // Dorado
    if (maxSupply <= 14) return { tag: 'RARE', bg: '#da70d6' };          // Púrpura
    if (maxSupply <= 40) return { tag: 'UNCOMMON', bg: '#5dade2' };      // Azul
    return { tag: 'COMMON', bg: '#a9a9a9' };                             // Gris
  }

  const rarity = getRarityTagAndColor(tokenData.maxSupply);
  console.log(`[floppy-render] Rarity calculada:`, rarity);

  // DETECCIÓN DE ANIMACIONES
  console.log('[floppy-render] Iniciando detección de animaciones...');
  
  // Construir path del trait para detección
  const normalizedCategory = normalizeCategory(tokenData.category);
  const traitPath = `${tokenData.tokenId}.svg`; // Usar solo el tokenId, no la categoría
  console.log(`[floppy-render] Categoría original: ${tokenData.category} -> Normalizada: ${normalizedCategory}`);
  console.log(`[floppy-render] Path del trait: ${traitPath}`);
  
  // Detectar si el trait es animado
  const isAnimated = await isTraitAnimated(tokenData, traitPath);
  
  if (isAnimated) {
    console.log(`[floppy-render] Trait animado detectado: ${traitPath}`);
  }
  
  console.log(`[floppy-render] Animación detectada: ${isAnimated}`);

  // Si hay animaciones, generar GIF (por ahora PNG con indicador)
  if (isAnimated) {
    console.log('[floppy-render] Generando formato animado...');
    const animatedBuffer = await generateAnimatedGif(tokenData, traitSvgContent);
    
    // Configurar headers para evitar cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Enviar imagen animada
    res.setHeader('Content-Type', 'image/png'); // Por ahora PNG, en el futuro GIF
    res.setHeader('Content-Length', animatedBuffer.length);
    res.send(animatedBuffer);
    
    console.log('[floppy-render] Renderizado animado completado exitosamente');
    return;
  }

  // LÓGICA ESPECIAL PARA TOKEN 262144 (SERUM ADRIANGF) - SERVIR GIF DIRECTAMENTE
  if (tokenIdNum === 262144) {
    console.log('[floppy-render] 🧬 LÓGICA ESPECIAL: Token 262144 detectado, sirviendo GIF directamente');
    
    const gifPath = path.join(process.cwd(), 'public', 'labimages', `${tokenId}.gif`);
    console.log(`[floppy-render] Ruta GIF: ${gifPath}`);
    console.log(`[floppy-render] Existe GIF: ${fs.existsSync(gifPath)}`);
    
    if (fs.existsSync(gifPath)) {
      const gifBuffer = fs.readFileSync(gifPath);
      console.log(`[floppy-render] GIF leído, tamaño: ${gifBuffer.length} bytes`);
      
      // Configurar headers para GIF
      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Devolver GIF directamente
      console.log(`[floppy-render] ===== GIF SERVIDO DIRECTAMENTE =====`);
      res.status(200).send(gifBuffer);
      return;
    } else {
      console.error(`[floppy-render] GIF no encontrado para token 262144`);
      res.status(404).json({ error: 'GIF no encontrado para serum ADRIANGF' });
      return;
    }
  }

  // Si no hay animaciones, continuar con renderizado SVG normal
  console.log('[floppy-render] Generando SVG estático...');

  // ===== SOLUCIÓN DEFINITIVA: SVG COMPLETO CON TEXTO CONVERTIDO A PATHS =====
  console.log(`[floppy-render] ===== CREANDO SVG COMPLETO CON TEXTO A PATHS =====`);
  
  // Cargar trait y mannequin usando método personalizado (como test-simple)
  console.log(`[floppy-render] Cargando trait ${tokenId} usando método personalizado...`);
  const traitImageData = await loadTraitFromLabimages(tokenId);
  
  if (!traitImageData) {
    console.error(`[floppy-render] No se pudo cargar el trait ${tokenId}`);
    res.status(500).json({ error: 'Error cargando trait' });
    return;
  }

  const mannequinImageData = await loadMannequinFromLabimages();
  
  if (!mannequinImageData) {
    console.error(`[floppy-render] No se pudo cargar el mannequin`);
    res.status(500).json({ error: 'Error cargando mannequin' });
    return;
  }

  // Crear SVG completo con texto convertido a paths
  const completeSvg = `
    <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
      <!-- Capa base en gris claro (bajo todos los elementos) -->
      <rect width="768" height="1024" fill="#f5f5f5"/>
      
      <!-- Frame SVG (fondo de todas las capas) -->
      <g transform="translate(0, 0)">
        ${fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', 'frameimproved.svg'), 'utf8')
          .replace(/<\?xml[^>]*\?>/, '')  // Eliminar declaración XML
          .replace(/<svg[^>]*>/, '')       // Eliminar tag de apertura SVG
          .replace(/<\/svg>/, '')}         // Eliminar tag de cierre SVG
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
      
      <!-- Logo AdrianLAB SVG (comentado para posible uso futuro):
      <g transform="translate(541, 922) scale(0.1167)">
        ${fs.readFileSync(path.join(process.cwd(), 'public', 'labimages', 'adrianlablogo1.svg'), 'utf8').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
      </g>
      -->
    </svg>
  `;

  console.log(`[floppy-render] SVG completo generado con texto convertido a paths`);

  try {
    // Renderizar SVG completo a PNG usando Resvg
    console.log(`[floppy-render] Renderizando SVG completo a PNG con Resvg...`);
    const resvg = new Resvg(Buffer.from(completeSvg), {
      fitTo: {
        mode: 'width',
        value: 768
      }
    });
    
    const pngBuffer = resvg.render().asPng();
    console.log(`[floppy-render] SVG completo renderizado a PNG, tamaño: ${pngBuffer.length} bytes`);

    // ===== GUARDAR EN CACHÉ Y RETORNAR =====
    setCachedFloppyRender(tokenIdNum, pngBuffer);
    
    const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
    console.log(`[floppy-render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

    // Configurar headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
    res.setHeader('X-Version', 'FLOPPY-METODO-PERSONALIZADO');
    
    // Devolver imagen
    console.log(`[floppy-render] ===== RENDERIZADO SVG COMPLETO FINALIZADO =====`);
    res.status(200).send(pngBuffer);
    
  } catch (error) {
    console.error('[floppy-render] Error renderizando SVG completo:', error);
    res.status(500).json({ error: 'Error renderizando imagen' });
  }
} 
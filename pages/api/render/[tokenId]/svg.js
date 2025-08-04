// API endpoint for rendering SVG tokens by tokenId
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';
import { Resvg } from '@resvg/resvg-js';
import { getContracts } from '../../../../lib/contracts.js';
import { 
  getCachedAdrianZeroSvg, 
  setCachedAdrianZeroSvg, 
  getAdrianZeroSvgTTL 
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

// Función para cargar SVG y detectar animación
const loadAndDetectAnimation = async (path) => {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const imageUrl = `${baseUrl}/traits/${path}`;
    
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const svgContent = await response.text();
    const isAnimated = detectSvgAnimation(svgContent);
    
    return {
      content: svgContent,
      isAnimated: isAnimated
    };
  } catch (error) {
    console.error(`Error cargando SVG ${path}:`, error.message);
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

// Función para generar SVG animado (placeholder)
const generateAnimatedSvg = async (equippedTraits, baseImagePath, skinTraitPath) => {
  // Por ahora, generamos un SVG con indicador de animación
  console.log('[render-svg] Generando SVG animado para traits animados');
  
  return `
    <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="1000" height="1000" fill="#ffffff"/>
      <text x="500" y="450" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="#ff0000">
        ANIMATED TRAIT DETECTED
      </text>
      <text x="500" y="500" font-family="Arial" font-size="24" text-anchor="middle" fill="#ff0000">
        SVG animation coming soon
      </text>
    </svg>
  `;
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

// Función para determinar si un trait debe renderizarse como HAIR
const shouldRenderAsHair = (traitId) => {
  // Lista de trait IDs que deben renderizarse como HAIR en lugar de HEAD
  const hairTraitIds = ['21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];
  return hairTraitIds.includes(traitId.toString());
};

// Función para corregir categorías según el trait ID
const correctCategory = (category, traitId) => {
  // LÓGICA ESPECIAL: HEAD 21-30 se renderiza como HAIR
  if (category === 'HEAD' && shouldRenderAsHair(traitId)) {
    console.log(`[render-svg] LÓGICA ESPECIAL: Corrigiendo HEAD ${traitId} a HAIR`);
    return 'HAIR';
  }
  
  return category;
};

// Función para determinar qué archivo de metadata usar según el token ID
const getMetadataFileForToken = (tokenId) => {
  const tokenIdNum = parseInt(tokenId);
  
  if (tokenIdNum >= 1 && tokenIdNum <= 9999) {
    return 'traits.json';
  } else if (tokenIdNum >= 10000 && tokenIdNum <= 19999) {
    return 'floppy.json';
  } else if (tokenIdNum >= 20000 && tokenIdNum <= 29999) {
    return 'pagers.json';
  } else if (tokenIdNum >= 30000 && tokenIdNum <= 35000) {
    return 'studio.json';
  } else if (tokenIdNum >= 40000 && tokenIdNum <= 49999) {
    return 'serums.json';
  } else {
    return 'traits.json'; // Default
  }
};

// Función para cargar metadata específica del token
const loadMetadataForToken = (tokenId) => {
  try {
    const metadataFile = getMetadataFileForToken(tokenId);
    const metadataPath = path.join(process.cwd(), 'public', 'labmetadata', metadataFile);
    
    if (!fs.existsSync(metadataPath)) {
      console.warn(`[render-svg] Archivo de metadata no encontrado: ${metadataPath}`);
      return null;
    }
    
    const metadataContent = fs.readFileSync(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataContent);
    
    // Buscar el token específico
    const tokenMetadata = metadata[tokenId];
    if (!tokenMetadata) {
      console.warn(`[render-svg] Token ${tokenId} no encontrado en ${metadataFile}`);
      return null;
    }
    
    console.log(`[render-svg] Metadata cargada para token ${tokenId} desde ${metadataFile}:`, {
      name: tokenMetadata.name,
      category: tokenMetadata.category,
      rarity: tokenMetadata.rarity
    });
    
    return tokenMetadata;
  } catch (error) {
    console.error(`[render-svg] Error cargando metadata para token ${tokenId}:`, error.message);
    return null;
  }
};

// Función para verificar si un trait de skin es una excepción
const isSkinTraitException = (traitId) => {
  // Lista de trait IDs que son excepciones de skin
  const skinExceptionIds = ['37', '38'];
  return skinExceptionIds.includes(traitId.toString());
};

// Función para obtener la ruta del trait de skin
const getSkinTraitPath = (traitId, generation) => {
  if (isSkinTraitException(traitId)) {
    return `SKIN/${traitId}.svg`;
  }
  return null;
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

  // Manejar preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Extraer tokenId de la ruta, eliminando .svg si existe
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.svg', '');
    console.log(`[render-svg] Iniciando renderizado SVG para token ${cleanTokenId}`);

    // Verify that tokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[render-svg] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // ===== SISTEMA DE CACHÉ PARA ADRIANZERO SVG =====
    const cachedSvg = getCachedAdrianZeroSvg(cleanTokenId);
    
    if (cachedSvg) {
      console.log(`[render-svg] 🎯 CACHE HIT para token ${cleanTokenId}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getAdrianZeroSvgTTL(cleanTokenId) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('X-Version', 'ADRIANZERO-SVG-OPTIMIZED');
      
      return res.status(200).send(cachedSvg);
    }

    console.log(`[render-svg] 💾 CACHE MISS para token ${cleanTokenId} - Generando SVG...`);

    // Por ahora, generar un SVG placeholder mientras implementamos la lógica completa
    const svgString = `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="1000" fill="#f0f0f0"/>
        <text x="500" y="450" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="#333">
          AdrianZERO ${cleanTokenId}
        </text>
        <text x="500" y="500" font-family="Arial" font-size="24" text-anchor="middle" fill="#333">
          SVG generation coming soon
        </text>
        <text x="500" y="550" font-family="Arial" font-size="18" text-anchor="middle" fill="#666">
          Use PNG endpoint for full rendering
        </text>
      </svg>
    `;

    // ===== GUARDAR EN CACHÉ Y RETORNAR =====
    setCachedAdrianZeroSvg(cleanTokenId, svgString);
    
    const ttlSeconds = Math.floor(getAdrianZeroSvgTTL(cleanTokenId) / 1000);
    console.log(`[render-svg] ✅ SVG cacheado por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${cleanTokenId}`);

    // Configurar headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
    res.setHeader('X-Version', 'ADRIANZERO-SVG-OPTIMIZED');
    res.send(svgString);

    console.log('[render-svg] Renderizado SVG completado exitosamente');

  } catch (error) {
    console.error('[render-svg] Error general:', error);
    console.error('[render-svg] Stack trace:', error.stack);
    
    const errorSvg = `
      <svg width="1000" height="1000" xmlns="http://www.w3.org/2000/svg">
        <rect width="1000" height="1000" fill="#cccccc"/>
        <text x="500" y="450" font-family="Arial" font-size="48" font-weight="bold" text-anchor="middle" fill="#000000">
          Error Rendering
        </text>
        <text x="500" y="500" font-family="Arial" font-size="24" text-anchor="middle" fill="#000000">
          Token #${req.query.tokenId?.replace('.svg', '') || 'Unknown'}
        </text>
        <text x="500" y="550" font-family="Arial" font-size="18" text-anchor="middle" fill="#000000">
          ${error.message.substring(0, 50)}
        </text>
      </svg>
    `;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorSvg);
  }
} 
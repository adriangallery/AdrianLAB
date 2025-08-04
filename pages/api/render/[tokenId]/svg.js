import { AdrianZeroRenderer } from '../../../../lib/renderers/adrianzero-renderer.js';
import { 
  getCachedAdrianZeroSvg, 
  setCachedAdrianZeroSvg, 
  getAdrianZeroSvgTTL 
} from '../../../../lib/cache.js';

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

    // ===== USAR LA NUEVA CLASE ADRIANZERO RENDERER =====
    const renderer = new AdrianZeroRenderer();
    const svgString = await renderer.generateSVG(cleanTokenId);

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
    
    // En caso de error, devolver un SVG de error
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
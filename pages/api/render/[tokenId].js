// API endpoint for rendering tokens by tokenId
import { AdrianZeroRenderer } from '../../../lib/renderers/adrianzero-renderer.js';
import { 
  getCachedAdrianZeroRender, 
  setCachedAdrianZeroRender, 
  getAdrianZeroRenderTTL 
} from '../../../lib/cache.js';

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
    // Extraer tokenId de la ruta, eliminando .png si existe
    const { tokenId } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    console.log(`[render] Iniciando renderizado para token ${cleanTokenId}`);

    // Verify that tokenId is valid
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      console.error(`[render] Token ID inválido: ${cleanTokenId}`);
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    // ===== SISTEMA DE CACHÉ PARA ADRIANZERO RENDER =====
    const cachedImage = getCachedAdrianZeroRender(cleanTokenId);
    
    if (cachedImage) {
      console.log(`[render] 🎯 CACHE HIT para token ${cleanTokenId}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Version', 'ADRIANZERO-CACHED');
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[render] 💾 CACHE MISS para token ${cleanTokenId} - Generando imagen...`);

    // ===== USAR LA NUEVA CLASE ADRIANZERO RENDERER =====
    const renderer = new AdrianZeroRenderer();
    const pngBuffer = await renderer.generatePNG(cleanTokenId);

    // ===== GUARDAR EN CACHÉ Y RETORNAR =====
    setCachedAdrianZeroRender(cleanTokenId, pngBuffer);
    
    const ttlSeconds = Math.floor(getAdrianZeroRenderTTL(cleanTokenId) / 1000);
    console.log(`[render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${cleanTokenId}`);

    // Configurar headers
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
    res.setHeader('X-Version', 'ADRIANZERO-CACHED');
    res.setHeader('Content-Length', pngBuffer.length);
    res.send(pngBuffer);

    console.log('[render] Renderizado completado exitosamente');

  } catch (error) {
    console.error('[render] Error general:', error);
    console.error('[render] Stack trace:', error.stack);
    
    // En caso de error, devolver una imagen de error
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Fondo gris
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Texto de error
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Error Rendering', 500, 450);
    ctx.font = '24px Arial';
    ctx.fillText(`Token #${req.query.tokenId?.replace('.png', '') || 'Unknown'}`, 500, 500);
    ctx.font = '18px Arial';
    ctx.fillText(error.message.substring(0, 50), 500, 550);
    
    const buffer = canvas.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  }
}
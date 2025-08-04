import { FloppyRenderer } from '../../../../../lib/renderers/floppy-renderer.js';
import { 
  getCachedFloppySvg, 
  setCachedFloppySvg, 
  getFloppySvgTTL 
} from '../../../../../lib/cache.js';

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
    
    if (tokenId && tokenId.endsWith('.svg')) {
      tokenId = tokenId.replace('.svg', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(tokenId);

    // ===== SISTEMA DE CACHÉ PARA FLOPPY SVG =====
    const cachedSvg = getCachedFloppySvg(tokenIdNum);
    
    if (cachedSvg) {
      console.log(`[floppy-svg] 🎯 CACHE HIT para token ${tokenIdNum}`);
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getFloppySvgTTL(tokenIdNum) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('X-Version', 'FLOPPY-SVG-OPTIMIZED');
      
      return res.status(200).send(cachedSvg);
    }

    console.log(`[floppy-svg] 💾 CACHE MISS para token ${tokenIdNum} - Generando SVG...`);
    console.log(`[floppy-svg] ===== RENDERIZADO SVG (1-9999) =====`);
    console.log(`[floppy-svg] Token ID: ${tokenId}`);

    // Procesar tokens 1-9999 (traits), 262144 (serum ADRIANGF) y 30000-35000 (T-shirts personalizados)
    if (tokenIdNum >= 1 && tokenIdNum <= 9999 || tokenIdNum === 262144 || (tokenIdNum >= 30000 && tokenIdNum <= 35000)) {
      console.log(`[floppy-svg] Procesando trait ${tokenId} (renderizado SVG)`);
      
      // Usar la nueva clase FloppyRenderer
      const renderer = new FloppyRenderer();
      const svgString = await renderer.generateSVG(tokenId);

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppySvg(tokenIdNum, svgString);
      
      const ttlSeconds = Math.floor(getFloppySvgTTL(tokenIdNum) / 1000);
      console.log(`[floppy-svg] ✅ SVG cacheado por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('X-Version', 'FLOPPY-SVG-OPTIMIZED');
      
      // Devolver SVG
      console.log(`[floppy-svg] ===== RENDERIZADO SVG FINALIZADO =====`);
      res.status(200).send(svgString);
      
    } else {
      res.status(400).json({ error: 'Este endpoint maneja tokens 1-9999 (traits), 262144 (serums) y 30000-35000 (T-shirts personalizados). Para otros tokens usa /api/metadata/floppy/[tokenId]' });
    }
  } catch (error) {
    console.error('[floppy-svg] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
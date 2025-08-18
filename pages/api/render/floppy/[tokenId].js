import { FloppyRenderer } from '../../../../lib/renderers/floppy-renderer.js';
import { 
  getCachedFloppyRender, 
  setCachedFloppyRender, 
  getFloppyRenderTTL 
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
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (tokenId && tokenId.endsWith('.gif')) {
      tokenId = tokenId.replace('.gif', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    const tokenIdNum = parseInt(tokenId);

    // ===== SISTEMA DE CACHÉ PARA FLOPPY RENDER =====
    const cachedImage = getCachedFloppyRender(tokenIdNum);
    
    if (cachedImage) {
      console.log(`[floppy-render] 🎯 CACHE HIT para token ${tokenIdNum}`);
      
      // Determinar si es un serum (GIF) o trait (PNG)
      const isSerum = tokenIdNum >= 262144 && tokenIdNum <= 262147;
      
      // Configurar headers de caché
      const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('Content-Type', isSerum ? 'image/gif' : 'image/png');
      res.setHeader('X-Version', 'FLOPPY-METODO-PERSONALIZADO');
      
      return res.status(200).send(cachedImage);
    }

    console.log(`[floppy-render] 💾 CACHE MISS para token ${tokenIdNum} - Generando imagen...`);
    console.log(`[floppy-render] ===== RENDERIZADO TRAITS (1-9999) =====`);
    console.log(`[floppy-render] Token ID: ${tokenId}`);

    // Procesar tokens 1-9999 (traits), 262144-262147 (serums) y 30000-35000 (T-shirts personalizados)
    if (
      (tokenIdNum >= 1 && tokenIdNum <= 9999) ||
      (tokenIdNum >= 262144 && tokenIdNum <= 262147) ||
      (tokenIdNum >= 30000 && tokenIdNum <= 35000) ||
      ((tokenIdNum >= 100001 && tokenIdNum <= 101003) || (tokenIdNum >= 101001 && tokenIdNum <= 101003))
    ) {
      
      // Determinar si es un serum (GIF) o trait (PNG)
      const isSerum = tokenIdNum >= 262144 && tokenIdNum <= 262147;
      console.log(`[floppy-render] Procesando ${isSerum ? 'serum' : 'trait'} ${tokenId} (renderizado ${isSerum ? 'GIF' : 'PNG'})`);
      
      // Usar la nueva clase FloppyRenderer
      const renderer = new FloppyRenderer();
      const imageBuffer = await renderer.generatePNG(tokenId);

      // ===== GUARDAR EN CACHÉ Y RETORNAR =====
      setCachedFloppyRender(tokenIdNum, imageBuffer);
      
      const ttlSeconds = Math.floor(getFloppyRenderTTL(tokenIdNum) / 1000);
      console.log(`[floppy-render] ✅ Imagen cacheada por ${ttlSeconds}s (${Math.floor(ttlSeconds/3600)}h) para token ${tokenIdNum}`);

      // Configurar headers según el tipo de imagen
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Content-Type', isSerum ? 'image/gif' : 'image/png');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`);
      res.setHeader('X-Version', 'FLOPPY-METODO-PERSONALIZADO');
      
      // Devolver imagen
      console.log(`[floppy-render] ===== RENDERIZADO SVG COMPLETO FINALIZADO =====`);
      res.status(200).send(imageBuffer);
      
    } else {
      res.status(400).json({ error: 'Este endpoint maneja tokens 1-9999 (traits), 262144-262147 (serums), 30000-35000 (T-shirts) y 100001-101003 (OGPUNKS TOP). Para otros tokens usa /api/metadata/floppy/[tokenId]' });
    }
  } catch (error) {
    console.error('[floppy-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
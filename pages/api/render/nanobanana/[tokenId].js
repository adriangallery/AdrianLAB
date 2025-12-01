// API endpoint para renderizar tokens con transformación Nanobanana
// Reutiliza el endpoint de render existente y aplica post-procesamiento con Nano Banana

import { loadImage } from 'canvas';
import { 
  getCachedNanobananaRender, 
  setCachedNanobananaRender 
} from '../../../../lib/cache.js';
import { transformWithNanoBanana } from '../../../../lib/nanobanana-transformer.js';

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
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { tokenId } = req.query;
    const cleanTokenId = tokenId?.toString().replace('.png', '') || tokenId;
    
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[nanobanana] 🍌 Request recibido para token ${cleanTokenId}`);

    // Verificar caché de Nanobanana
    const cachedNanobanana = getCachedNanobananaRender(cleanTokenId);
    if (cachedNanobanana) {
      console.log(`[nanobanana] 🎯 CACHE HIT para token ${cleanTokenId}`);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Version', 'ADRIANZERO-NANOBANANA');
      res.setHeader('X-Transform-Status', 'success');
      return res.status(200).send(cachedNanobanana);
    }

    console.log(`[nanobanana] 💾 CACHE MISS para token ${cleanTokenId} - Generando...`);

    // ===== PASO 1: Obtener PNG base del endpoint de render existente =====
    console.log(`[nanobanana] 📸 Obteniendo imagen PNG base del render existente...`);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://adrianlab.vercel.app';
    const renderUrl = `${baseUrl}/api/render/${cleanTokenId}.png`;
    
    let originalPngBuffer;
    try {
      const renderResponse = await fetch(renderUrl);
      if (!renderResponse.ok) {
        throw new Error(`Error obteniendo imagen base: ${renderResponse.status} ${renderResponse.statusText}`);
      }
      const arrayBuffer = await renderResponse.arrayBuffer();
      originalPngBuffer = Buffer.from(arrayBuffer);
      console.log(`[nanobanana] ✅ Imagen PNG base obtenida (${originalPngBuffer.length} bytes)`);
    } catch (error) {
      console.error(`[nanobanana] ❌ Error obteniendo imagen base:`, error.message);
      return res.status(500).json({ 
        error: 'Error obteniendo imagen base del render',
        details: error.message 
      });
    }

    // ===== PASO 2: Transformar con Nano Banana =====
    console.log(`[nanobanana] 🍌 Transformando imagen con Nano Banana...`);
    let transformedBuffer;
    let transformStatus = 'success';
    
    try {
      // Obtener prompt personalizado de query params si existe
      const customPrompt = req.query.prompt || null;
      
      transformedBuffer = await transformWithNanoBanana(originalPngBuffer, customPrompt);
      console.log(`[nanobanana] ✅ Transformación completada (${transformedBuffer.length} bytes)`);
    } catch (error) {
      console.error(`[nanobanana] ❌ Error en transformación Nano Banana:`, error.message);
      console.error(`[nanobanana] Stack:`, error.stack);
      
      // Fallback: retornar PNG original si falla la transformación
      console.log(`[nanobanana] ⚠️ Fallback: retornando PNG original sin transformar`);
      transformedBuffer = originalPngBuffer;
      transformStatus = 'fallback';
    }

    // ===== PASO 3: Guardar en caché y retornar =====
    setCachedNanobananaRender(cleanTokenId, transformedBuffer);
    console.log(`[nanobanana] ✅ Imagen cacheada para token ${cleanTokenId}`);

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', transformedBuffer.length);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Version', 'ADRIANZERO-NANOBANANA');
    res.setHeader('X-Transform-Status', transformStatus);
    res.setHeader('X-Original-Size', originalPngBuffer.length.toString());
    res.setHeader('X-Transformed-Size', transformedBuffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas

    console.log(`[nanobanana] 🍌 Renderizado Nanobanana completado exitosamente`);
    res.status(200).send(transformedBuffer);

  } catch (error) {
    console.error('[nanobanana] ❌ Error general:', error);
    console.error('[nanobanana] Stack trace:', error.stack);
    
    // En caso de error crítico, retornar error JSON
    res.status(500).json({ 
      error: 'Error procesando imagen Nanobanana',
      details: error.message 
    });
  }
}


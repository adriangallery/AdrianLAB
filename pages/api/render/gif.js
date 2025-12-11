import { GifRenderer } from '../../../lib/renderers/gif-renderer.js';

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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parsear query params
    const { tokenId, frames, pattern, delay, category } = req.query;
    
    // Validar parámetros requeridos
    if (!tokenId) {
      return res.status(400).json({ error: 'tokenId es requerido' });
    }
    
    if (!frames) {
      return res.status(400).json({ error: 'frames es requerido' });
    }
    
    if (!pattern) {
      return res.status(400).json({ error: 'pattern es requerido (ej: "324,870")' });
    }
    
    // Validar y convertir frames
    const framesNum = parseInt(frames);
    if (isNaN(framesNum) || framesNum < 1 || framesNum > 100) {
      return res.status(400).json({ error: 'frames debe ser un número entre 1 y 100' });
    }
    
    // Parsear pattern (separado por comas)
    const patternArray = pattern.split(',').map(p => p.trim()).filter(p => p);
    if (patternArray.length === 0) {
      return res.status(400).json({ error: 'pattern debe contener al menos un traitId' });
    }
    
    // Validar que todos los traitIds son números válidos
    for (const traitId of patternArray) {
      if (isNaN(parseInt(traitId))) {
        return res.status(400).json({ error: `traitId inválido en pattern: ${traitId}` });
      }
    }
    
    // Parsear delay (opcional, default 100ms)
    const delayMs = delay ? parseInt(delay) : 100;
    if (isNaN(delayMs) || delayMs < 10 || delayMs > 1000) {
      return res.status(400).json({ error: 'delay debe ser un número entre 10 y 1000 ms' });
    }
    
    // Categoría (opcional, solo para logging, no afecta la ruta del trait)
    const traitCategory = category || null;
    
    console.log(`[gif-render] Request recibido:`, {
      tokenId,
      frames: framesNum,
      pattern: patternArray,
      delay: delayMs,
      category: traitCategory
    });
    
    // Crear instancia de GifRenderer
    const gifRenderer = new GifRenderer();
    
    // Generar GIF
    const gifBuffer = await gifRenderer.generateGif({
      tokenId,
      frames: framesNum,
      pattern: patternArray,
      delay: delayMs,
      category: traitCategory
    });
    
    // Configurar headers
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', gifBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Version', 'GIF-RENDERER-v2');
    res.setHeader('X-Render-Source', 'local');
    res.setHeader('X-Frame-Count', framesNum.toString());
    res.setHeader('X-Frame-Delay', `${delayMs}ms`);
    res.setHeader('X-Pattern', patternArray.join(','));
    if (traitCategory) res.setHeader('X-Category', traitCategory);
    
    console.log(`[gif-render] GIF generado exitosamente (${gifBuffer.length} bytes)`);
    
    return res.status(200).send(gifBuffer);
    
  } catch (error) {
    console.error(`[gif-render] Error:`, error);
    return res.status(500).json({ 
      error: 'Error generando GIF',
      details: error.message 
    });
  }
}


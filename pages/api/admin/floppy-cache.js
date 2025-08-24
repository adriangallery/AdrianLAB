import { 
  getCachedFloppyRender, 
  setCachedFloppyRender, 
  getFloppyRenderTTL,
  clearFloppyRenderCache,
  getFloppyRenderCacheStats
} from '../../../lib/cache.js';

export default async function handler(req, res) {
  // Configurar CORS para administración
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verificar método HTTP
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // GET: Ver estado del caché
    if (req.method === 'GET') {
      const { tokenId } = req.query;
      
      if (tokenId) {
        // Ver caché de un token específico
        const cachedImage = getCachedFloppyRender(parseInt(tokenId));
        const ttl = getFloppyRenderTTL(parseInt(tokenId));
        
        return res.status(200).json({
          action: 'GET_CACHE_STATUS',
          tokenId: parseInt(tokenId),
          hasCache: !!cachedImage,
          cacheSize: cachedImage ? cachedImage.length : 0,
          ttl: ttl,
          ttlFormatted: `${Math.floor(ttl / 1000)}s (${Math.floor(ttl / 3600)}h)`,
          timestamp: new Date().toISOString()
        });
      } else {
        // Ver estadísticas generales del caché
        const stats = getFloppyRenderCacheStats();
        
        return res.status(200).json({
          action: 'GET_CACHE_STATS',
          stats,
          timestamp: new Date().toISOString()
        });
      }
    }

    // POST: Limpiar caché de un token específico
    if (req.method === 'POST') {
      const { tokenId, action } = req.body;
      
      if (!tokenId) {
        return res.status(400).json({ error: 'tokenId es requerido' });
      }

      if (action === 'clear') {
        // Limpiar caché de un token específico
        const tokenIdNum = parseInt(tokenId);
        const cachedImage = getCachedFloppyRender(tokenIdNum);
        
        if (cachedImage) {
          // Establecer el caché como null para "limpiarlo"
          setCachedFloppyRender(tokenIdNum, null);
          
          return res.status(200).json({
            action: 'CLEAR_INDIVIDUAL_CACHE',
            tokenId: tokenIdNum,
            status: 'CLEARED',
            previousSize: cachedImage.length,
            message: `Caché del token ${tokenIdNum} limpiado exitosamente`,
            timestamp: new Date().toISOString()
          });
        } else {
          return res.status(404).json({
            action: 'CLEAR_INDIVIDUAL_CACHE',
            tokenId: tokenIdNum,
            status: 'NOT_FOUND',
            message: `No hay caché para el token ${tokenIdNum}`,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        return res.status(400).json({ error: 'Acción no válida. Use "clear"' });
      }
    }

    // DELETE: Limpiar todo el caché
    if (req.method === 'DELETE') {
      const { confirm } = req.query;
      
      if (confirm !== 'true') {
        return res.status(400).json({ 
          error: 'Confirmación requerida. Use ?confirm=true para limpiar todo el caché',
          warning: 'Esta acción limpiará TODO el caché de floppy render'
        });
      }

      const stats = getFloppyRenderCacheStats();
      clearFloppyRenderCache();
      
      return res.status(200).json({
        action: 'CLEAR_ALL_CACHE',
        status: 'CLEARED',
        previousStats: stats,
        message: 'Todo el caché de floppy render ha sido limpiado',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[admin/floppy-cache] Error:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 
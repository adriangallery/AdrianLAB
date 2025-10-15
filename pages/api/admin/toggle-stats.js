// API endpoint para estadísticas de toggles
import { getToggleCacheStats, getAllTokensWithToggles, clearToggleCache, forceUpdateToggles } from '../../../lib/toggle-cache.js';
import { getContracts } from '../../../lib/contracts.js';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Obtener estadísticas del caché
      const stats = getToggleCacheStats();
      const tokensWithToggles = getAllTokensWithToggles();
      
      res.status(200).json({
        success: true,
        data: {
          cache: stats,
          tokens: tokensWithToggles,
          summary: {
            totalTokens: stats.totalTokens,
            tokensWithToggles: stats.tokensWithToggles,
            totalToggles: stats.totalToggles,
            lastUpdate: stats.lastUpdate,
            nextUpdate: stats.nextUpdate
          }
        }
      });
      
    } else if (req.method === 'POST') {
      const { action } = req.body;
      
      if (action === 'clear') {
        // Limpiar caché de toggles
        const clearedCount = clearToggleCache();
        res.status(200).json({
          success: true,
          message: `Caché de toggles limpiado (${clearedCount} entradas eliminadas)`,
          clearedCount
        });
        
      } else if (action === 'force-update') {
        // Forzar actualización de toggles
        const { zoomInZeros } = await getContracts();
        await forceUpdateToggles(zoomInZeros);
        
        const stats = getToggleCacheStats();
        res.status(200).json({
          success: true,
          message: 'Toggles actualizados forzadamente',
          data: stats
        });
        
      } else {
        res.status(400).json({
          success: false,
          error: 'Acción no válida. Usar: clear, force-update'
        });
      }
      
    } else {
      res.status(405).json({
        success: false,
        error: 'Método no permitido'
      });
    }
    
  } catch (error) {
    console.error('[admin/toggle-stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

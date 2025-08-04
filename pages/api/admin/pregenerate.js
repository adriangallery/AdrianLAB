import { 
  PREGEN_CONFIG,
  getPregenerationStats,
  savePregeneratedFile,
  schedulePregeneration
} from '../../../lib/cache.js';

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
      // Obtener estadísticas de precarga
      const stats = getPregenerationStats();
      
      return res.status(200).json({
        success: true,
        stats,
        config: PREGEN_CONFIG
      });
    }

    if (req.method === 'POST') {
      const { action, tokenId, traits, type = 'custom', priority = 'MEDIUM' } = req.body;

      let result = {};

      switch (action) {
        case 'pregenerate_single':
          if (!tokenId) {
            return res.status(400).json({ error: 'tokenId required' });
          }
          
          // Por ahora solo programar, en futuras implementaciones aquí iría la generación real
          schedulePregeneration(tokenId, traits || [], null, priority);
          
          result.message = `Pregeneración programada para token ${tokenId}`;
          result.tokenId = tokenId;
          result.traits = traits || [];
          result.type = type;
          result.priority = priority;
          break;

        case 'pregenerate_range':
          const { startId, endId } = req.body;
          
          if (!startId || !endId || isNaN(parseInt(startId)) || isNaN(parseInt(endId))) {
            return res.status(400).json({ error: 'startId and endId required and must be numbers' });
          }
          
          const start = parseInt(startId);
          const end = parseInt(endId);
          const count = end - start + 1;
          
          // Programar precarga para el rango
          for (let i = start; i <= end; i++) {
            schedulePregeneration(i, [], null, priority);
          }
          
          result.message = `Pregeneración programada para rango ${start}-${end} (${count} tokens)`;
          result.range = { start, end, count };
          result.priority = priority;
          break;

        case 'pregenerate_critical':
          // Pregenerar tokens críticos
          const criticalTokens = [
            ...PREGEN_CONFIG.critical.featured,
            ...PREGEN_CONFIG.critical.tshirts_sample.slice(0, 10) // Solo primeros 10 para prueba
          ];
          
          let criticalCount = 0;
          criticalTokens.forEach(tokenId => {
            schedulePregeneration(tokenId, [], null, 'MAXIMUM');
            criticalCount++;
          });
          
          result.message = `Pregeneración programada para ${criticalCount} tokens críticos`;
          result.tokens = criticalTokens;
          result.count = criticalCount;
          break;

        default:
          return res.status(400).json({ error: 'Invalid action. Use: pregenerate_single, pregenerate_range, pregenerate_critical' });
      }

      console.log(`[admin-pregenerate] ${result.message}`);
      
      return res.status(200).json({
        success: true,
        ...result
      });
    }

  } catch (error) {
    console.error('[admin-pregenerate] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
} 
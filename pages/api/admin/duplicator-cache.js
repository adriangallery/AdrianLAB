import {
  clearDuplicatorCache,
  getDuplicatorCacheStats,
  invalidateDupInfo
} from '../../../lib/duplicator-cache.js';

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
    // GET: Ver estadísticas del caché de duplicación
    if (req.method === 'GET') {
      const stats = getDuplicatorCacheStats();

      return res.status(200).json({
        action: 'GET_DUPLICATOR_CACHE_STATS',
        stats,
        timestamp: new Date().toISOString()
      });
    }

    // POST: Invalidar caché de token(s) específico(s)
    if (req.method === 'POST') {
      const { tokenId, tokenIds } = req.body;

      // Invalidar múltiples tokens
      if (tokenIds && Array.isArray(tokenIds)) {
        const results = tokenIds.map(id => ({
          tokenId: id,
          invalidated: invalidateDupInfo(id)
        }));

        const invalidatedCount = results.filter(r => r.invalidated).length;

        return res.status(200).json({
          action: 'INVALIDATE_MULTIPLE',
          results,
          summary: {
            requested: tokenIds.length,
            invalidated: invalidatedCount,
            notFound: tokenIds.length - invalidatedCount
          },
          message: `Se invalidaron ${invalidatedCount} de ${tokenIds.length} tokens`,
          timestamp: new Date().toISOString()
        });
      }

      // Invalidar un solo token
      if (tokenId) {
        const invalidated = invalidateDupInfo(tokenId);

        return res.status(200).json({
          action: 'INVALIDATE_SINGLE',
          tokenId,
          invalidated,
          message: invalidated
            ? `Caché de duplicación del token ${tokenId} invalidado`
            : `No había caché para el token ${tokenId}`,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(400).json({
        error: 'tokenId o tokenIds es requerido',
        example: { tokenId: 699 },
        exampleMultiple: { tokenIds: [694, 698, 699] }
      });
    }

    // DELETE: Limpiar TODO el caché de duplicación
    if (req.method === 'DELETE') {
      const { confirm } = req.query;

      if (confirm !== 'true') {
        return res.status(400).json({
          error: 'Confirmación requerida. Use ?confirm=true para limpiar todo el caché',
          warning: 'Esta acción limpiará TODO el caché de duplicación',
          hint: 'Esto forzará consultas frescas al contrato DuplicatorMODULE'
        });
      }

      const statsBefore = getDuplicatorCacheStats();
      const entriesCleared = clearDuplicatorCache();

      return res.status(200).json({
        action: 'CLEAR_ALL_DUPLICATOR_CACHE',
        status: 'CLEARED',
        entriesCleared,
        previousStats: statsBefore,
        message: 'Todo el caché de duplicación ha sido limpiado. Las próximas consultas irán directamente al contrato.',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[admin/duplicator-cache] Error:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

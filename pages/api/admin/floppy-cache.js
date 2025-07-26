import { 
  invalidateFloppyMetadata,
  invalidateFloppyMetadataRange, 
  invalidateAllFloppyMetadata,
  getFloppyMetadataCacheStats,
  getFloppyMetadataTTL
} from '../../../lib/cache.js';

export default async function handler(req, res) {
  // Verificar método
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'GET') {
      // Obtener estadísticas del caché de floppy metadata
      const stats = getFloppyMetadataCacheStats();
      return res.status(200).json({
        success: true,
        stats,
        ttlConfig: {
          traits: `${getFloppyMetadataTTL(1) / 3600000}h`,
          floppys: `${getFloppyMetadataTTL(10000) / 3600000}h`,
          serum: `${getFloppyMetadataTTL(262144) / 3600000}h`
        }
      });
    }

    if (req.method === 'POST') {
      const { action, tokenId, startId, endId } = req.body;

      let result = {};

      switch (action) {
        case 'invalidate_token':
          if (!tokenId) {
            return res.status(400).json({ error: 'tokenId required' });
          }
          const invalidated = invalidateFloppyMetadata(tokenId);
          result.invalidated = invalidated ? 1 : 0;
          result.message = invalidated 
            ? `Caché invalidado para token ${tokenId}` 
            : `Token ${tokenId} no estaba en caché`;
          break;

        case 'invalidate_range':
          if (!startId || !endId) {
            return res.status(400).json({ error: 'startId and endId required' });
          }
          result.invalidated = invalidateFloppyMetadataRange(startId, endId);
          result.message = `Caché invalidado para tokens ${startId}-${endId}`;
          break;

        case 'clear_all':
          result.invalidated = invalidateAllFloppyMetadata();
          result.message = 'Todo el caché de floppy metadata ha sido limpiado';
          break;

        case 'invalidate_traits':
          result.invalidated = invalidateFloppyMetadataRange(1, 9999);
          result.message = 'Caché de traits (1-9999) invalidado';
          break;

        case 'invalidate_floppys':
          result.invalidated = invalidateFloppyMetadataRange(10000, 15500);
          result.message = 'Caché de floppys (10000-15500) invalidado';
          break;

        case 'invalidate_serum':
          const serumInvalidated = invalidateFloppyMetadata(262144);
          result.invalidated = serumInvalidated ? 1 : 0;
          result.message = serumInvalidated 
            ? 'Caché de serum (262144) invalidado'
            : 'Serum no estaba en caché';
          break;

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }

      console.log(`[admin-floppy-cache] ${result.message} - ${result.invalidated} entries`);
      
      return res.status(200).json({
        success: true,
        ...result
      });
    }

  } catch (error) {
    console.error('[admin-floppy-cache] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
} 
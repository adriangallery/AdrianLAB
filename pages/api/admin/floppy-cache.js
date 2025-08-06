import { 
  invalidateFloppyMetadata,
  invalidateFloppyMetadataRange, 
  invalidateAllFloppyMetadata,
  getFloppyMetadataCacheStats,
  getFloppyMetadataTTL,
  invalidateFloppyRender,
  invalidateFloppyRenderRange,
  invalidateAllFloppyRender,
  getFloppyRenderCacheStats,
  getFloppyRenderTTL,
  invalidateFloppyAll,
  invalidateFloppyAllRange,
  invalidateAllFloppy,
  invalidateAdrianZeroRender,
  invalidateAdrianZeroRenderRange,
  getAdrianZeroRenderCacheStats,
  getAdrianZeroRenderTTL,
  getContractCacheStats,
  clearContractCache,
  clearContractCacheForToken,
  cleanupExpiredContractEntries,
  getJsonCacheStats,
  clearJsonCache,
  cleanupExpiredJsonEntries
} from '../../../lib/cache.js';

export default async function handler(req, res) {
  // Verificar método
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (req.method === 'GET') {
      // Obtener estadísticas del caché de floppy metadata y render
      const metadataStats = getFloppyMetadataCacheStats();
      const renderStats = getFloppyRenderCacheStats();
      const adrianZeroStats = getAdrianZeroRenderCacheStats();
      const contractStats = await getContractCacheStats();
      const jsonStats = await getJsonCacheStats();
      
      return res.status(200).json({
        success: true,
        metadata: {
          stats: metadataStats,
          ttlConfig: {
            traits: `${getFloppyMetadataTTL(1) / 3600000}h`,
            floppys: `${getFloppyMetadataTTL(10000) / 3600000}h`,
            serum: `${getFloppyMetadataTTL(262144) / 3600000}h`
          }
        },
        render: {
          stats: renderStats,
          ttlConfig: {
            traits: `${getFloppyRenderTTL(1) / 3600000}h`,
            floppys: `${getFloppyRenderTTL(10000) / 3600000}h`,
            serum: `${getFloppyRenderTTL(262144) / 3600000}h`
          }
        },
        adrianZero: {
          stats: adrianZeroStats,
          ttlConfig: {
            normal: `${getAdrianZeroRenderTTL(1) / 3600000}h`,
            tshirts: `${getAdrianZeroRenderTTL(30000) / 3600000}h`,
            serum: `${getAdrianZeroRenderTTL(262144) / 3600000}h`
          }
        },
        contracts: {
          stats: contractStats,
          ttlConfig: {
            all: '24h'
          }
        },
        json: {
          stats: jsonStats,
          ttlConfig: {
            all: '7 días'
          }
        }
      });
    }

    if (req.method === 'POST') {
      const { action, tokenId, startId, endId, type } = req.body;

      let result = {};

      switch (action) {
        case 'invalidate_token':
          if (!tokenId) {
            return res.status(400).json({ error: 'tokenId required' });
          }
          
          if (type === 'render') {
            const invalidated = invalidateFloppyRender(tokenId);
            result.invalidated = invalidated ? 1 : 0;
            result.message = invalidated 
              ? `Render caché invalidado para token ${tokenId}` 
              : `Token ${tokenId} no estaba en render caché`;
          } else if (type === 'metadata') {
            const invalidated = invalidateFloppyMetadata(tokenId);
            result.invalidated = invalidated ? 1 : 0;
            result.message = invalidated 
              ? `Metadata caché invalidado para token ${tokenId}` 
              : `Token ${tokenId} no estaba en metadata caché`;
          } else {
            // Invalidar ambos por defecto
            const invalidated = invalidateFloppyAll(tokenId);
            result.invalidated = invalidated.total;
            result.message = `Caché invalidado para token ${tokenId} (metadata: ${invalidated.metadata ? 1 : 0}, render: ${invalidated.render ? 1 : 0})`;
          }
          break;

        case 'invalidate_range':
          if (!startId || !endId) {
            return res.status(400).json({ error: 'startId and endId required' });
          }
          
          if (type === 'render') {
            result.invalidated = invalidateFloppyRenderRange(startId, endId);
            result.message = `Render caché invalidado para tokens ${startId}-${endId}`;
          } else if (type === 'metadata') {
            result.invalidated = invalidateFloppyMetadataRange(startId, endId);
            result.message = `Metadata caché invalidado para tokens ${startId}-${endId}`;
          } else {
            // Invalidar ambos por defecto
            const invalidated = invalidateFloppyAllRange(startId, endId);
            result.invalidated = invalidated.total;
            result.message = `Caché invalidado para tokens ${startId}-${endId} (metadata: ${invalidated.metadata}, render: ${invalidated.render})`;
          }
          break;

        case 'clear_all':
          if (type === 'render') {
            result.invalidated = invalidateAllFloppyRender();
            result.message = 'Todo el caché de floppy render ha sido limpiado';
          } else if (type === 'metadata') {
            result.invalidated = invalidateAllFloppyMetadata();
            result.message = 'Todo el caché de floppy metadata ha sido limpiado';
          } else {
            // Invalidar ambos por defecto
            const invalidated = invalidateAllFloppy();
            result.invalidated = invalidated.total;
            result.message = `Todo el caché ha sido limpiado (metadata: ${invalidated.metadata}, render: ${invalidated.render})`;
          }
          break;

        case 'invalidate_traits':
          if (type === 'render') {
            result.invalidated = invalidateFloppyRenderRange(1, 9999);
            result.message = 'Render caché de traits (1-9999) invalidado';
          } else if (type === 'metadata') {
            result.invalidated = invalidateFloppyMetadataRange(1, 9999);
            result.message = 'Metadata caché de traits (1-9999) invalidado';
          } else {
            // Invalidar ambos por defecto
            const invalidated = invalidateFloppyAllRange(1, 9999);
            result.invalidated = invalidated.total;
            result.message = `Caché de traits (1-9999) invalidado (metadata: ${invalidated.metadata}, render: ${invalidated.render})`;
          }
          break;

        case 'invalidate_floppys':
          if (type === 'render') {
            result.invalidated = invalidateFloppyRenderRange(10000, 15500);
            result.message = 'Render caché de floppys (10000-15500) invalidado';
          } else if (type === 'metadata') {
            result.invalidated = invalidateFloppyMetadataRange(10000, 15500);
            result.message = 'Metadata caché de floppys (10000-15500) invalidado';
          } else {
            // Invalidar ambos por defecto
            const invalidated = invalidateFloppyAllRange(10000, 15500);
            result.invalidated = invalidated.total;
            result.message = `Caché de floppys (10000-15500) invalidado (metadata: ${invalidated.metadata}, render: ${invalidated.render})`;
          }
          break;

        case 'invalidate_serum':
          if (type === 'render') {
            const serumInvalidated = invalidateFloppyRender(262144);
            result.invalidated = serumInvalidated ? 1 : 0;
            result.message = serumInvalidated 
              ? 'Render caché de serum (262144) invalidado'
              : 'Serum no estaba en render caché';
          } else if (type === 'metadata') {
            const serumInvalidated = invalidateFloppyMetadata(262144);
            result.invalidated = serumInvalidated ? 1 : 0;
            result.message = serumInvalidated 
              ? 'Metadata caché de serum (262144) invalidado'
              : 'Serum no estaba en metadata caché';
          } else {
            // Invalidar ambos por defecto
            const invalidated = invalidateFloppyAll(262144);
            result.invalidated = invalidated.total;
            result.message = `Caché de serum (262144) invalidado (metadata: ${invalidated.metadata ? 1 : 0}, render: ${invalidated.render ? 1 : 0})`;
          }
          break;

        case 'invalidate_adrianzero_normal':
          result.invalidated = invalidateAdrianZeroRenderRange(1, 9999);
          result.message = 'AdrianZero render caché de tokens normales (1-9999) invalidado';
          break;

        case 'invalidate_adrianzero_tshirts':
          result.invalidated = invalidateAdrianZeroRenderRange(30000, 35000);
          result.message = 'AdrianZero render caché de T-shirts (30000-35000) invalidado';
          break;

        case 'invalidate_adrianzero_serum':
          const adrianZeroSerumInvalidated = invalidateAdrianZeroRender(262144);
          result.invalidated = adrianZeroSerumInvalidated ? 1 : 0;
          result.message = adrianZeroSerumInvalidated 
            ? 'AdrianZero render caché de serum (262144) invalidado'
            : 'Serum no estaba en AdrianZero render caché';
          break;

        case 'clear_contract_cache':
          result.invalidated = await clearContractCache();
          result.message = 'Caché de contratos completamente limpiado';
          break;

        case 'clear_contract_cache_token':
          if (!tokenId) {
            return res.status(400).json({ error: 'tokenId required for contract cache clear' });
          }
          result.invalidated = await clearContractCacheForToken(tokenId);
          result.message = `Caché de contratos limpiado para token ${tokenId}`;
          break;

        case 'cleanup_expired_contracts':
          result.invalidated = await cleanupExpiredContractEntries();
          result.message = 'Entradas expiradas del caché de contratos limpiadas';
          break;

        case 'clear_json_cache':
          result.invalidated = await clearJsonCache();
          result.message = 'Caché de archivos JSON completamente limpiado';
          break;

        case 'cleanup_expired_json':
          result.invalidated = await cleanupExpiredJsonEntries();
          result.message = 'Archivos JSON expirados limpiados';
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
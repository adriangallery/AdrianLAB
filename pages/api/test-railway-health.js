// Endpoint para verificar el estado del servicio externo de Railway
import { checkExternalServiceHealth } from '../../lib/external-render-client.js';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const EXTERNAL_RENDER_URL = process.env.EXTERNAL_RENDER_URL;
    const EXTERNAL_RENDER_ENABLED = process.env.EXTERNAL_RENDER_ENABLED !== 'false';
    
    const info = {
      configured: !!EXTERNAL_RENDER_URL,
      enabled: EXTERNAL_RENDER_ENABLED,
      url: EXTERNAL_RENDER_URL || 'No configurada',
      healthCheck: null,
      error: null
    };

    if (!EXTERNAL_RENDER_URL) {
      return res.status(200).json({
        status: 'not_configured',
        message: 'EXTERNAL_RENDER_URL no está configurada en las variables de entorno',
        info
      });
    }

    if (!EXTERNAL_RENDER_ENABLED) {
      return res.status(200).json({
        status: 'disabled',
        message: 'El servicio externo está deshabilitado',
        info
      });
    }

    // Intentar health check
    console.log('[test-railway-health] Verificando salud del servicio externo...');
    const isHealthy = await checkExternalServiceHealth();
    
    info.healthCheck = isHealthy ? 'ok' : 'failed';
    
    if (isHealthy) {
      return res.status(200).json({
        status: 'healthy',
        message: 'El servicio externo de Railway está activo y respondiendo',
        info
      });
    } else {
      return res.status(200).json({
        status: 'unhealthy',
        message: 'El servicio externo de Railway no está respondiendo o no está disponible',
        info
      });
    }
  } catch (error) {
    console.error('[test-railway-health] Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error al verificar el servicio externo',
      error: error.message,
      info: {
        configured: !!process.env.EXTERNAL_RENDER_URL,
        enabled: process.env.EXTERNAL_RENDER_ENABLED !== 'false',
        url: process.env.EXTERNAL_RENDER_URL || 'No configurada',
        healthCheck: 'error'
      }
    });
  }
}


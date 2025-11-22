/**
 * Script para mantener el servicio de Render despierto
 * Útil para el plan gratuito que se duerme después de 15 minutos
 * 
 * Uso:
 * - Ejecutar en un cron job cada 10-14 minutos
 * - O usar un servicio como cron-job.org o similar
 * 
 * Ejemplo de cron (cada 12 minutos):
 * */12 * * * * curl https://tu-servicio.onrender.com/health
 */

const RENDER_URL = process.env.EXTERNAL_RENDER_URL || process.env.RENDER_URL;

if (!RENDER_URL) {
  console.error('❌ EXTERNAL_RENDER_URL o RENDER_URL no está configurada');
  process.exit(1);
}

const cleanUrl = RENDER_URL.replace(/\/$/, '');
const healthUrl = `${cleanUrl}/health`;

console.log(`🔍 Verificando servicio en: ${healthUrl}`);

fetch(healthUrl)
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error(`HTTP ${response.status}`);
  })
  .then(data => {
    console.log('✅ Servicio está activo:', data);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error al verificar servicio:', error.message);
    process.exit(1);
  });


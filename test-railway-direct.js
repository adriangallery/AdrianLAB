// Script para verificar directamente el servicio de Railway
// Uso: node test-railway-direct.js [URL_DE_RAILWAY]

const railwayUrl = process.argv[2] || process.env.EXTERNAL_RENDER_URL;

if (!railwayUrl) {
  console.log('❌ No se proporcionó URL de Railway');
  console.log('\nUso:');
  console.log('  node test-railway-direct.js https://tu-servicio.up.railway.app');
  console.log('\nO configura la variable de entorno:');
  console.log('  EXTERNAL_RENDER_URL=https://tu-servicio.up.railway.app node test-railway-direct.js');
  process.exit(1);
}

// Limpiar la URL (eliminar trailing slash)
const cleanUrl = railwayUrl.replace(/\/$/, '');
const healthUrl = `${cleanUrl}/health`;

console.log('🔍 Verificando servicio de Railway...');
console.log(`📍 URL: ${cleanUrl}`);
console.log(`🏥 Health check: ${healthUrl}\n`);

async function checkRailwayHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

    const startTime = Date.now();
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'AdrianLAB-HealthCheck/1.0'
      }
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Servicio de Railway está ACTIVO');
      console.log(`⏱️  Tiempo de respuesta: ${duration}ms`);
      console.log(`📊 Respuesta:`, JSON.stringify(data, null, 2));
      console.log(`\n✅ El servicio está funcionando correctamente`);
      return true;
    } else {
      console.log(`❌ Servicio respondió con error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`📄 Respuesta: ${text}`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️  Timeout: El servicio no respondió en 10 segundos');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('❌ No se pudo conectar al servicio');
      console.log(`   Error: ${error.message}`);
      console.log(`\n💡 Posibles causas:`);
      console.log(`   - El servicio fue eliminado de Railway`);
      console.log(`   - La URL es incorrecta`);
      console.log(`   - El servicio está caído`);
    } else {
      console.log(`❌ Error al verificar el servicio: ${error.message}`);
    }
    return false;
  }
}

checkRailwayHealth()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Error inesperado:', error);
    process.exit(1);
  });


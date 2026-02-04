#!/usr/bin/env node

/**
 * Script para limpiar el caché de duplicación
 *
 * Uso:
 *   node scripts/clear-duplicator-cache.js [--all] [--tokens 694,698,699]
 *
 * Para producción (Vercel), usar el endpoint:
 *   DELETE /api/admin/duplicator-cache?confirm=true  - Limpia todo
 *   POST /api/admin/duplicator-cache con body { tokenIds: [694, 698, 699] } - Tokens específicos
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function clearAll() {
  console.log('🧹 Limpiando TODO el caché de duplicación...');

  try {
    const response = await fetch(`${BASE_URL}/api/admin/duplicator-cache?confirm=true`, {
      method: 'DELETE'
    });

    const result = await response.json();
    console.log('✅ Resultado:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Tip: Asegúrate de que el servidor está corriendo en', BASE_URL);
    console.log('   O usa API_URL=https://tu-dominio.vercel.app para producción');
    process.exit(1);
  }
}

async function clearTokens(tokenIds) {
  console.log(`🧹 Invalidando caché para tokens: ${tokenIds.join(', ')}...`);

  try {
    const response = await fetch(`${BASE_URL}/api/admin/duplicator-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenIds })
    });

    const result = await response.json();
    console.log('✅ Resultado:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Tip: Asegúrate de que el servidor está corriendo en', BASE_URL);
    process.exit(1);
  }
}

async function getStats() {
  console.log('📊 Obteniendo estadísticas del caché...');

  try {
    const response = await fetch(`${BASE_URL}/api/admin/duplicator-cache`);
    const result = await response.json();
    console.log('📊 Stats:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Uso: node scripts/clear-duplicator-cache.js [opciones]

Opciones:
  --all              Limpia TODO el caché de duplicación
  --tokens 694,698   Invalida tokens específicos (separados por coma)
  --stats            Muestra estadísticas del caché
  --help, -h         Muestra esta ayuda

Variables de entorno:
  API_URL            URL base del API (default: http://localhost:3000)

Ejemplos:
  node scripts/clear-duplicator-cache.js --all
  node scripts/clear-duplicator-cache.js --tokens 694,698,699
  API_URL=https://adrianlab.vercel.app node scripts/clear-duplicator-cache.js --all
`);
  process.exit(0);
}

if (args.includes('--stats')) {
  getStats();
} else if (args.includes('--all')) {
  clearAll();
} else if (args.includes('--tokens')) {
  const tokensIndex = args.indexOf('--tokens');
  const tokensArg = args[tokensIndex + 1];

  if (!tokensArg) {
    console.error('❌ Error: --tokens requiere una lista de IDs separados por coma');
    console.log('   Ejemplo: --tokens 694,698,699');
    process.exit(1);
  }

  const tokenIds = tokensArg.split(',').map(id => parseInt(id.trim(), 10));
  clearTokens(tokenIds);
} else {
  // Por defecto, limpiar los tokens conocidos como problemáticos
  console.log('ℹ️  No se especificó opción. Limpiando tokens problemáticos conocidos...');
  clearTokens([694, 698, 699]);
}

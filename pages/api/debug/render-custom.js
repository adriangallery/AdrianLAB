// Endpoint de debug para render custom - Captura todos los logs del proceso
import { getContracts } from '../../../lib/contracts.js';
import { renderViaExternalService, prepareRenderData } from '../../../lib/external-render-client.js';

// Capturar todos los logs
const logs = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function captureLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  logs.push({
    timestamp,
    level,
    message
  });
  
  // También mostrar en consola real
  if (level === 'error') {
    originalConsoleError(...args);
  } else if (level === 'warn') {
    originalConsoleWarn(...args);
  } else {
    originalConsoleLog(...args);
  }
}

function startLogCapture() {
  console.log = (...args) => captureLog('log', ...args);
  console.error = (...args) => captureLog('error', ...args);
  console.warn = (...args) => captureLog('warn', ...args);
}

function stopLogCapture() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Limpiar logs anteriores
  logs.length = 0;
  
  const { tokenId, trait } = req.query;
  const testTokenId = tokenId || '393';
  
  // Manejar múltiples traits (pueden venir como array o string separado por comas)
  let testTraits = [];
  if (trait) {
    if (Array.isArray(trait)) {
      testTraits = trait;
    } else if (typeof trait === 'string' && trait.includes(',')) {
      testTraits = trait.split(',').map(t => t.trim());
    } else {
      testTraits = [trait];
    }
  } else {
    testTraits = ['1107', '1116'];
  }
  
  logs.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: `📋 Parámetros recibidos: tokenId=${testTokenId}, traits=${testTraits.join(', ')}`
  });
  
  startLogCapture();
  
  try {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '🚀 Iniciando prueba de render custom...'
    });

    // 1. Verificar conexión con contratos
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '📡 Paso 1: Conectando con contratos...'
    });

    const contracts = await getContracts();
    
    // Obtener información del provider usado
    const provider = contracts.core.provider;
    const network = await provider.getNetwork();
    
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: '✅ Contratos conectados exitosamente'
    });
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `🌐 Red conectada: ${network.name} (Chain ID: ${network.chainId})`
    });
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `🔗 Provider URL: ${provider.connection?.url || 'N/A'}`
    });

    // 2. Obtener datos del token
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `📊 Paso 2: Obteniendo datos del token ${testTokenId}...`
    });

    const tokenData = await contracts.core.getTokenData(testTokenId);
    const [generation, mutationLevel, canReplicate, replicationCount, lastReplication, hasBeenModified] = tokenData;
    
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `✅ TokenData obtenido: generation=${generation.toString()}, mutationLevel=${mutationLevel.toString()}`
    });

    // 3. Obtener skin
    const tokenSkinData = await contracts.core.getTokenSkin(testTokenId);
    const skinId = tokenSkinData[0].toString();
    const skinName = tokenSkinData[1];
    
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `✅ Skin obtenido: skinId=${skinId}, skinName=${skinName}`
    });

    // 4. Obtener traits equipados
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '🎨 Paso 3: Obteniendo traits equipados...'
    });

    const nested = await contracts.traitsExtension.getAllEquippedTraits(testTokenId);
    const categories = nested[0];
    const traitIds = nested[1];
    
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `✅ Traits equipados: ${categories.length} categorías`
    });

    // 5. Preparar datos para renderizado externo
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '🔧 Paso 4: Preparando datos para renderizado...'
    });

    // Crear mapa de traits finales
    const finalTraits = {};
    categories.forEach((category, index) => {
      finalTraits[category] = traitIds[index].toString();
    });

    // Aplicar traits personalizados
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `🎨 Aplicando ${testTraits.length} trait(s) personalizado(s)...`
    });
    
    testTraits.forEach((traitId, index) => {
      // Para múltiples traits, usar categorías comunes
      const categoryOrder = ['SWAG', 'HEAD', 'GEAR', 'BACKGROUND', 'EYES', 'MOUTH'];
      const category = categoryOrder[index] || categories[index] || 'SWAG';
      finalTraits[category] = traitId;
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `  → Trait ${traitId} aplicado a categoría ${category}`
      });
    });

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: `✅ Traits finales: ${JSON.stringify(finalTraits, null, 2)}`
    });

    // 6. Verificar configuración de Railway
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '🚀 Paso 5: Verificando configuración de Railway...'
    });

    const EXTERNAL_RENDER_URL = process.env.EXTERNAL_RENDER_URL;
    const EXTERNAL_RENDER_ENABLED = process.env.EXTERNAL_RENDER_ENABLED !== 'false';
    
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `📍 URL de Railway: ${EXTERNAL_RENDER_URL || 'No configurada'}`
    });
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `🔧 Railway habilitado: ${EXTERNAL_RENDER_ENABLED}`
    });

    if (!EXTERNAL_RENDER_URL) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: '⚠️ EXTERNAL_RENDER_URL no está configurada en Vercel'
      });
    }

    // 7. Preparar datos para renderizado
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: '🔧 Paso 6: Preparando datos para renderizado...'
    });

    const renderData = prepareRenderData({
      tokenId: testTokenId,
      generation: generation.toString(),
      skinType: skinName || 'Medium',
      finalTraits,
      appliedSerum: null,
      serumSuccess: false,
      hasAdrianGFSerum: false,
      serumHistory: null,
      failedSerumType: null,
      baseImagePath: `ADRIAN/GEN${generation.toString()}-${skinName || 'Medium'}.svg`,
      skintraitPath: null,
      skinTraitPath: null,
      isCloseup: false,
      traitsMapping: {}
    });

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `📦 Datos preparados: ${JSON.stringify({
        tokenId: renderData.tokenId,
        generation: renderData.generation,
        skinType: renderData.skinType,
        traitsCount: Object.keys(renderData.finalTraits).length,
        baseImagePath: renderData.baseImagePath
      }, null, 2)}`
    });

    // 8. Intentar renderizado externo
    if (EXTERNAL_RENDER_URL && EXTERNAL_RENDER_ENABLED) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `🚀 Paso 7: Intentando renderizado externo en Railway (${EXTERNAL_RENDER_URL})...`
      });

      const startTime = Date.now();
      try {
        const externalRenderBuffer = await renderViaExternalService(renderData);
        const duration = Date.now() - startTime;

        if (externalRenderBuffer) {
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'success',
            message: `✅ Renderizado externo exitoso! Tiempo: ${duration}ms, Tamaño: ${externalRenderBuffer.length} bytes`
          });
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `📦 Header X-Render-Source: external (Railway procesó la imagen)`
          });
        } else {
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: '⚠️ Renderizado externo falló (retornó null), se usaría fallback local en Vercel'
          });
        }
      } catch (error) {
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `❌ Error en renderizado externo: ${error.message}`
        });
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'warn',
          message: '⚠️ Se usaría fallback local en Vercel'
        });
      }
    } else {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: '⚠️ Railway no está configurado o deshabilitado, se usaría renderizado local en Vercel'
      });
    }

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'success',
      message: '✅ Prueba completada exitosamente'
    });

  } catch (error) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `❌ Error: ${error.message}`
    });
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: `Stack: ${error.stack}`
    });
  } finally {
    stopLogCapture();
  }

  // Generar HTML con consola de logs
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug Render Custom - AdrianLAB</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: #4ec9b0;
      margin-bottom: 20px;
      font-size: 2em;
    }
    .controls {
      background: #252526;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #3e3e42;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      color: #cccccc;
      margin-bottom: 5px;
      font-size: 0.9em;
    }
    input {
      width: 100%;
      padding: 10px;
      background: #1e1e1e;
      border: 1px solid #3e3e42;
      color: #d4d4d4;
      border-radius: 4px;
      font-family: inherit;
      font-size: 1em;
    }
    input:focus {
      outline: none;
      border-color: #007acc;
    }
    button {
      background: #007acc;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1em;
      font-weight: 600;
      transition: background 0.2s;
    }
    button:hover {
      background: #005a9e;
    }
    .console {
      background: #1e1e1e;
      border: 1px solid #3e3e42;
      border-radius: 8px;
      padding: 20px;
      max-height: 70vh;
      overflow-y: auto;
      font-size: 0.9em;
    }
    .log-entry {
      margin-bottom: 8px;
      padding: 4px 0;
      border-left: 3px solid transparent;
      padding-left: 10px;
    }
    .log-entry.log { border-left-color: #4ec9b0; }
    .log-entry.info { border-left-color: #4ec9b0; }
    .log-entry.success { border-left-color: #4ec9b0; }
    .log-entry.warn { border-left-color: #dcdcaa; }
    .log-entry.error { border-left-color: #f48771; }
    .timestamp {
      color: #858585;
      font-size: 0.85em;
      margin-right: 10px;
    }
    .level {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.8em;
      font-weight: 600;
      margin-right: 10px;
      min-width: 60px;
      text-align: center;
    }
    .level.log, .level.info { background: #264f78; color: #4ec9b0; }
    .level.success { background: #0e4a1e; color: #4ec9b0; }
    .level.warn { background: #5a4a1e; color: #dcdcaa; }
    .level.error { background: #5a1e1e; color: #f48771; }
    .message {
      color: #d4d4d4;
    }
    .copy-button {
      background: #3e3e42;
      color: #d4d4d4;
      padding: 8px 16px;
      border: 1px solid #3e3e42;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      margin-top: 10px;
    }
    .copy-button:hover {
      background: #464647;
    }
    .stats {
      background: #252526;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      border: 1px solid #3e3e42;
    }
    .stat-item {
      display: inline-block;
      margin-right: 20px;
      color: #cccccc;
    }
    .stat-value {
      color: #4ec9b0;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🐛 Debug Render Custom</h1>
    
    <div class="controls">
      <form id="debugForm" method="GET">
        <div class="form-group">
          <label for="tokenId">Token ID:</label>
          <input type="text" id="tokenId" name="tokenId" value="${testTokenId}" placeholder="393">
        </div>
        <div class="form-group">
          <label for="trait">Traits (separados por comas o múltiples parámetros trait=):</label>
          <input type="text" id="trait" name="trait" value="${testTraits.join(',')}" placeholder="1107,1116">
        </div>
        <button type="submit">Ejecutar Prueba</button>
      </form>
    </div>

    <div class="stats">
      <div class="stat-item">
        <span>Total Logs:</span>
        <span class="stat-value" id="totalLogs">${logs.length}</span>
      </div>
      <div class="stat-item">
        <span>Errores:</span>
        <span class="stat-value" id="errorCount">${logs.filter(l => l.level === 'error').length}</span>
      </div>
      <div class="stat-item">
        <span>Warnings:</span>
        <span class="stat-value" id="warnCount">${logs.filter(l => l.level === 'warn').length}</span>
      </div>
    </div>

    <div style="margin-bottom: 10px;">
      <button class="copy-button" onclick="copyLogs()">📋 Copiar Todos los Logs</button>
      <button class="copy-button" onclick="copyLogsAsJSON()">📋 Copiar como JSON</button>
    </div>

    <div class="console" id="console">
      ${logs.map(log => {
        const escapedMessage = log.message
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        return `
        <div class="log-entry ${log.level}">
          <span class="timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
          <span class="level">${log.level.toUpperCase()}</span>
          <span class="message">${escapedMessage}</span>
        </div>
      `;
      }).join('')}
    </div>
  </div>

  <script>
    function copyLogs() {
      const logsText = ${JSON.stringify(logs.map(l => 
        \`[\${l.timestamp}] [\${l.level.toUpperCase()}] \${l.message}\`
      ).join('\\n'))};
      
      navigator.clipboard.writeText(logsText).then(() => {
        alert('✅ Logs copiados al portapapeles');
      }).catch(err => {
        console.error('Error copiando:', err);
      });
    }

    function copyLogsAsJSON() {
      const logsJSON = JSON.stringify(${JSON.stringify(logs)}, null, 2);
      
      navigator.clipboard.writeText(logsJSON).then(() => {
        alert('✅ Logs copiados como JSON al portapapeles');
      }).catch(err => {
        console.error('Error copiando:', err);
      });
    }

    // Auto-scroll al final
    const console = document.getElementById('console');
    console.scrollTop = console.scrollHeight;
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}


import express from 'express';
import cors from 'cors';
import { renderImage } from './renderer.js';
import { renderGif } from './gif-renderer.js';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://adrianlab.vercel.app';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root endpoint - Página de información y pruebas
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AdrianLAB External Render Service</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 2.5em;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 1.1em;
    }
    .status {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9em;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #764ba2;
      margin-bottom: 15px;
      font-size: 1.5em;
    }
    .endpoint {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
      font-family: 'Courier New', monospace;
    }
    .method {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 0.85em;
      margin-right: 10px;
    }
    .method.get { background: #10b981; color: white; }
    .method.post { background: #3b82f6; color: white; }
    .test-form {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
      color: #374151;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      font-size: 1em;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      background: #667eea;
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 1em;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
    }
    button:hover {
      background: #5568d3;
    }
    .result {
      margin-top: 20px;
      padding: 15px;
      border-radius: 8px;
      display: none;
    }
    .result.success {
      background: #d1fae5;
      color: #065f46;
      border: 2px solid #10b981;
    }
    .result.error {
      background: #fee2e2;
      color: #991b1b;
      border: 2px solid #ef4444;
    }
    .result img {
      max-width: 100%;
      border-radius: 8px;
      margin-top: 10px;
    }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .info {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin-top: 20px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 AdrianLAB External Render</h1>
    <p class="subtitle">Servicio externo de renderizado para imágenes AdrianZERO</p>
    <span class="status">✅ Servicio Activo</span>

    <div class="section">
      <h2>📡 Endpoints Disponibles</h2>
      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/health</code> - Health check del servicio
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/render</code> - Renderizar imagen AdrianZERO
      </div>
      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/gif</code> - Generar GIF animado
      </div>
    </div>

    <div class="section">
      <h2>🧪 Prueba de Renderizado</h2>
      <div class="test-form">
        <form id="testForm">
          <div class="form-group">
            <label for="tokenId">Token ID:</label>
            <input type="number" id="tokenId" name="tokenId" value="1" min="1" required>
          </div>
          <button type="submit">Renderizar Token</button>
        </form>
        <div id="result" class="result"></div>
      </div>
    </div>

    <div class="info">
      <strong>ℹ️ Nota:</strong> Este formulario hace una prueba básica. Para renderizado completo con traits personalizados, usa el endpoint <code>POST /render</code> con el JSON completo desde Vercel.
    </div>
  </div>

  <script>
    document.getElementById('testForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tokenId = document.getElementById('tokenId').value;
      const resultDiv = document.getElementById('result');
      
      resultDiv.style.display = 'block';
      resultDiv.className = 'result';
      resultDiv.innerHTML = '<p>Cargando...</p>';

      try {
        // Hacer una prueba simple llamando al health check primero
        const healthResponse = await fetch('/health');
        const healthData = await healthResponse.json();
        
        if (!healthData.status === 'ok') {
          throw new Error('El servicio no está saludable');
        }

        resultDiv.className = 'result success';
        resultDiv.innerHTML = \`
          <p><strong>✅ Servicio activo</strong></p>
          <p>Health check: \${JSON.stringify(healthData, null, 2)}</p>
          <p><strong>Token ID:</strong> \${tokenId}</p>
          <p><em>Para renderizar este token, usa el endpoint POST /render desde Vercel con los datos completos del token.</em></p>
        \`;
      } catch (error) {
        resultDiv.className = 'result error';
        resultDiv.innerHTML = \`<p><strong>❌ Error:</strong> \${error.message}</p>\`;
      }
    });
  </script>
</body>
</html>
  `;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'external-render' });
});

// Render endpoint
app.post('/render', async (req, res) => {
  try {
    const startTime = Date.now();
    console.log('[external-render] 📥 Request recibido:', {
      tokenId: req.body.tokenId,
      generation: req.body.generation,
      hasTraits: !!req.body.finalTraits
    });

    const pngBuffer = await renderImage(req.body, BASE_URL);
    
    const duration = Date.now() - startTime;
    console.log(`[external-render] ✅ Renderizado completado en ${duration}ms`);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', pngBuffer.length);
    res.setHeader('X-Render-Time', duration.toString());
    res.setHeader('X-Service', 'external-render');
    res.status(200).send(pngBuffer);
  } catch (error) {
    console.error('[external-render] ❌ Error:', error.message);
    console.error('[external-render] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error rendering image', 
      message: error.message 
    });
  }
});

// GIF endpoint
app.post('/gif', async (req, res) => {
  try {
    const startTime = Date.now();
    console.log('[external-render] 🎬 GIF request recibido:', {
      tokenId: req.body.tokenId,
      frames: req.body.frames,
      pattern: req.body.pattern,
      delay: req.body.delay
    });

    const gifBuffer = await renderGif(req.body, BASE_URL);
    
    const duration = Date.now() - startTime;
    console.log(`[external-render] ✅ GIF generado en ${duration}ms`);

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', gifBuffer.length);
    res.setHeader('X-Render-Time', duration.toString());
    res.setHeader('X-Service', 'external-render');
    res.setHeader('X-Frame-Count', req.body.frames?.toString() || '0');
    res.setHeader('X-Frame-Delay', `${req.body.delay || 100}ms`);
    res.status(200).send(gifBuffer);
  } catch (error) {
    console.error('[external-render] ❌ Error generando GIF:', error.message);
    console.error('[external-render] Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error generating GIF', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`[external-render] 🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`[external-render] 🌐 Base URL: ${BASE_URL}`);
  console.log(`[external-render] 🎬 Soporte GIF habilitado`);
});


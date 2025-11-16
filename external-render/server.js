import express from 'express';
import cors from 'cors';
import { renderImage } from './renderer.js';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://adrianlab.vercel.app';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

app.listen(PORT, () => {
  console.log(`[external-render] 🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`[external-render] 🌐 Base URL: ${BASE_URL}`);
});


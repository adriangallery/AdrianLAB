import { getCachedAdrianZeroRender, getCachedFloppyRender } from '../../../lib/cache.js';
import { createCanvas, loadImage } from 'canvas';

export default async function handler(req, res) {
  // Configurar CORS para administración
  res.setHeader('Access-Control-Allow-Origin', 'https://adrianlab.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { startToken, endToken, columns } = req.body;
    
    // Validaciones
    if (!startToken || !endToken || !columns) {
      return res.status(400).json({ 
        error: 'startToken, endToken y columns son requeridos' 
      });
    }
    
    const start = parseInt(startToken);
    const end = parseInt(endToken);
    const cols = parseInt(columns);
    
    if (start < 1 || end < start || cols < 1) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos: startToken debe ser >= 1, endToken >= startToken, columns >= 1' 
      });
    }
    
    if (end - start + 1 > 10000) {
      return res.status(400).json({ 
        error: 'Rango demasiado grande. Máximo 10,000 tokens por grid' 
      });
    }

    // Calcular dimensiones del grid
    const totalTokens = end - start + 1;
    const rows = Math.ceil(totalTokens / cols);
    
    // Tamaño del grid final (aproximadamente 800x800)
    const gridWidth = cols * 64;
    const gridHeight = rows * 64;
    
    console.log(`[grid-generator] Generando grid: ${start}-${end}, ${cols} columnas, ${rows} filas, ${gridWidth}x${gridHeight}`);

    // Crear canvas para el grid
    const canvas = createCanvas(gridWidth, gridHeight);
    const ctx = canvas.getContext('2d');
    
    // Fondo transparente
    ctx.clearRect(0, 0, gridWidth, gridHeight);
    
    // Borde oscuro alrededor del grid completo
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, gridWidth - 2, gridHeight - 2);

    // Generar grid
    let currentToken = start;
    let processed = 0;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (currentToken > end) break;
        
        try {
          // Obtener imagen del caché según el tipo de token
          let cachedImage = null;
          
          if (currentToken >= 1 && currentToken <= 9999) {
            // Tokens 1-9999: usar caché de AdrianZero render (tokens normales)
            cachedImage = getCachedAdrianZeroRender(currentToken);
          } else if (currentToken >= 10000 && currentToken <= 15500) {
            // Tokens 10000-15500: usar caché de floppy render (floppys)
            cachedImage = getCachedFloppyRender(currentToken);
          } else {
            // Otros tokens: usar caché de AdrianZero render
            cachedImage = getCachedAdrianZeroRender(currentToken);
          }
          
          if (cachedImage) {
            // Convertir buffer a imagen
            const image = await loadImage(cachedImage);
            
            // Calcular posición en el grid
            const x = col * 64;
            const y = row * 64;
            
            // Dibujar imagen redimensionada a 64x64
            ctx.drawImage(image, x, y, 64, 64);
            
            processed++;
          } else {
            console.warn(`[grid-generator] Token ${currentToken} no encontrado en caché, renderizando...`);
            
            try {
              // Renderizar el token que no está en caché
              const renderResponse = await fetch(`https://adrianlab.vercel.app/api/render/${currentToken}`);
              
              if (renderResponse.ok) {
                const imageBuffer = await renderResponse.arrayBuffer();
                const image = await loadImage(Buffer.from(imageBuffer));
                
                // Calcular posición en el grid
                const x = col * 64;
                const y = row * 64;
                
                // Dibujar imagen redimensionada a 64x64
                ctx.drawImage(image, x, y, 64, 64);
                
                processed++;
                console.log(`[grid-generator] Token ${currentToken} renderizado exitosamente`);
              } else {
                throw new Error(`Error renderizando token ${currentToken}: ${renderResponse.status}`);
              }
            } catch (renderError) {
              console.error(`[grid-generator] Error renderizando token ${currentToken}:`, renderError.message);
              // Dibujar placeholder de error
              ctx.fillStyle = '#ffcccc';
              ctx.fillRect(col * 64, row * 64, 64, 64);
              ctx.fillStyle = '#cc0000';
              ctx.font = '10px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('ERR', col * 64 + 32, row * 64 + 32);
            }
          }
        } catch (error) {
          console.error(`[grid-generator] Error procesando token ${currentToken}:`, error.message);
          // Dibujar placeholder de error
          ctx.fillStyle = '#ffcccc';
          ctx.fillRect(col * 64, row * 64, 64, 64);
          ctx.fillStyle = '#cc0000';
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('ERR', col * 64 + 32, row * 64 + 32);
        }
        
        currentToken++;
      }
    }

    console.log(`[grid-generator] Grid completado: ${processed}/${totalTokens} tokens procesados`);

    // Convertir a JPEG optimizado
    const jpegBuffer = canvas.toBuffer('image/jpeg', { 
      quality: 0.85,
      progressive: true
    });

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
    res.setHeader('X-Grid-Info', `tokens:${start}-${end}, columns:${cols}, size:${gridWidth}x${gridHeight}, processed:${processed}`);
    
    // Enviar imagen
    res.status(200).send(jpegBuffer);

  } catch (error) {
    console.error('[grid-generator] Error:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}

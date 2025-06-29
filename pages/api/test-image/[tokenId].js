import { Resvg } from '@resvg/resvg-js';
import { textToSVGElement, linesToSVG } from '../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[test-image] ===== TEST IMAGEN CON PATHS INICIADO =====`);
    console.log(`[test-image] Token ID: ${tokenId}`);

    // Crear SVG con texto convertido a paths
    const svgWithPaths = `
      <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
        <!-- Fondo -->
        <rect width="768" height="1024" fill="#1a1a1a"/>
        
        <!-- Marco del floppy disk -->
        <rect x="84" y="120" width="600" height="600" fill="#2a2a2a" stroke="#444" stroke-width="4"/>
        
        <!-- Texto convertido a paths -->
        ${textToSVGElement('FLOPPY DISK', {
          x: 384,
          y: 200,
          fontSize: 48,
          fill: '#00ff00'
        })}
        
        ${textToSVGElement('Token #' + tokenId, {
          x: 384,
          y: 280,
          fontSize: 36,
          fill: '#ffff00'
        })}
        
        ${textToSVGElement('AdrianLAB', {
          x: 384,
          y: 360,
          fontSize: 32,
          fill: '#ff69b4'
        })}
        
        ${textToSVGElement('Text to Path', {
          x: 384,
          y: 440,
          fontSize: 28,
          fill: '#00ffff'
        })}
        
        <!-- Múltiples líneas -->
        ${linesToSVG([
          {
            text: 'Línea 1',
            x: 384,
            y: 520,
            fontSize: 24,
            fill: '#ff8800'
          },
          {
            text: 'Línea 2',
            x: 384,
            y: 560,
            fontSize: 24,
            fill: '#8800ff'
          },
          {
            text: 'Línea 3',
            x: 384,
            y: 600,
            fontSize: 24,
            fill: '#ff0088'
          }
        ])}
        
        <!-- Texto normal para comparar -->
        <text x="384" y="680" font-family="Arial" font-size="20" text-anchor="middle" fill="#888888">Texto normal (comparación)</text>
        <text x="384" y="720" font-family="Arial" font-size="16" text-anchor="middle" fill="#888888">Paths arriba, texto aquí</text>
      </svg>
    `;

    console.log(`[test-image] SVG generado, longitud: ${svgWithPaths.length}`);

    try {
      const resvg = new Resvg(Buffer.from(svgWithPaths), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      
      console.log(`[test-image] ===== TEST IMAGEN COMPLETADO =====`);
      console.log(`[test-image] Imagen generada, tamaño: ${pngBuffer.length} bytes`);
      
      // Configurar headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Devolver imagen
      res.status(200).send(pngBuffer);
      
    } catch (error) {
      console.error('[test-image] Error renderizando imagen:', error);
      res.status(500).json({ 
        error: 'Error renderizando imagen',
        details: error.message
      });
    }
    
  } catch (error) {
    console.error('[test-image] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
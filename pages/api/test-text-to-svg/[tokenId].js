import { Resvg } from '@resvg/resvg-js';
import { textToSVGElement, linesToSVG, createSVGWithPaths } from '../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[test-text-to-svg] ===== TEST TEXT-TO-SVG INICIADO =====`);
    console.log(`[test-text-to-svg] Token ID: ${tokenId}`);

    // Test 1: Elemento individual
    const testElement = textToSVGElement('TEST ELEMENT', {
      x: 384,
      y: 100,
      fontSize: 48,
      fill: '#ff0000'
    });

    // Test 2: Múltiples líneas
    const testLines = linesToSVG([
      {
        text: 'LINE 1',
        x: 384,
        y: 200,
        fontSize: 32,
        fill: '#00ff00'
      },
      {
        text: 'LINE 2',
        x: 384,
        y: 250,
        fontSize: 32,
        fill: '#0000ff'
      },
      {
        text: `Token ${tokenId}`,
        x: 384,
        y: 300,
        fontSize: 24,
        fill: '#ff6600'
      }
    ]);

    // Test 3: SVG completo con paths
    const completeSvg = createSVGWithPaths({
      width: 768,
      height: 1024,
      backgroundColor: '#ffffff',
      elements: [
        {
          type: 'rect',
          x: 84,
          y: 120,
          width: 600,
          height: 600,
          fill: '#f0f0f0'
        },
        {
          type: 'text',
          text: 'TRAIT #6',
          options: {
            x: 384,
            y: 400,
            fontSize: 48,
            fill: '#ff0000'
          }
        },
        {
          type: 'text',
          text: 'UNISEX',
          options: {
            x: 384,
            y: 500,
            fontSize: 32,
            fill: '#00ff00'
          }
        },
        {
          type: 'text',
          text: 'MOUTH',
          options: {
            x: 384,
            y: 550,
            fontSize: 24,
            fill: '#0000ff'
          }
        },
        {
          type: 'text',
          text: 'AdrianLAB',
          options: {
            x: 384,
            y: 650,
            fontSize: 36,
            fill: '#ff69b4'
          }
        }
      ]
    });

    // Crear imagen combinada con todos los tests
    const combinedSvg = `
      <svg width="768" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="768" height="800" fill="#ffffff"/>
        
        <!-- Test 1: Elemento individual -->
        <g transform="translate(0, 0)">
          <rect width="768" height="200" fill="#f0f0f0" stroke="#ccc"/>
          <text x="384" y="30" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Test 1: Elemento Individual</text>
          ${testElement}
        </g>
        
        <!-- Test 2: Múltiples líneas -->
        <g transform="translate(0, 200)">
          <rect width="768" height="200" fill="#f0f0f0" stroke="#ccc"/>
          <text x="384" y="30" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Test 2: Múltiples Líneas</text>
          ${testLines}
        </g>
        
        <!-- Test 3: SVG completo -->
        <g transform="translate(0, 400)">
          <rect width="768" height="200" fill="#f0f0f0" stroke="#ccc"/>
          <text x="384" y="30" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Test 3: SVG Completo</text>
          <g transform="translate(0, 50) scale(0.3)">
            ${completeSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
          </g>
        </g>
        
        <!-- Test 4: Comparación con texto normal -->
        <g transform="translate(0, 600)">
          <rect width="768" height="200" fill="#f0f0f0" stroke="#ccc"/>
          <text x="384" y="30" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Test 4: Comparación (Texto Normal)</text>
          <text x="384" y="100" font-family="Arial" font-size="48" text-anchor="middle" fill="#ff0000">TEXTO NORMAL</text>
          <text x="384" y="150" font-family="Arial" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
        </g>
      </svg>
    `;

    try {
      const resvg = new Resvg(Buffer.from(combinedSvg), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const pngBuffer = resvg.render().asPng();
      
      console.log(`[test-text-to-svg] ===== TEST TEXT-TO-SVG COMPLETADO =====`);
      console.log(`[test-text-to-svg] Imagen generada, tamaño: ${pngBuffer.length} bytes`);
      
      // Configurar headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Devolver imagen
      res.status(200).send(pngBuffer);
      
    } catch (error) {
      console.error('[test-text-to-svg] Error renderizando imagen:', error);
      res.status(500).json({ 
        error: 'Error renderizando imagen',
        details: error.message
      });
    }
    
  } catch (error) {
    console.error('[test-text-to-svg] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
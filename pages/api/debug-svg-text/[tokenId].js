import { Resvg } from '@resvg/resvg-js';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[debug-svg-text] ===== DEBUG SVG TEXT INICIADO =====`);
    console.log(`[debug-svg-text] Token ID: ${tokenId}`);

    // Crear múltiples versiones de SVG con diferentes configuraciones de texto
    const testSvgs = [
      // Test 1: Texto básico con Arial
      {
        name: "Arial básico",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="200" font-family="Arial" font-size="48" text-anchor="middle" fill="#ff0000">TEST ARIAL</text>
            <text x="384" y="300" font-family="Arial" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
          </svg>
        `
      },
      // Test 2: Texto con sans-serif
      {
        name: "sans-serif",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="200" font-family="sans-serif" font-size="48" text-anchor="middle" fill="#ff0000">TEST SANS-SERIF</text>
            <text x="384" y="300" font-family="sans-serif" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
          </svg>
        `
      },
      // Test 3: Texto con múltiples fallbacks
      {
        name: "Fallbacks",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="200" font-family="Arial, Helvetica, sans-serif" font-size="48" text-anchor="middle" fill="#ff0000">TEST FALLBACKS</text>
            <text x="384" y="300" font-family="Arial, Helvetica, sans-serif" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
          </svg>
        `
      },
      // Test 4: Texto con stroke
      {
        name: "Con stroke",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="200" font-family="Arial" font-size="48" text-anchor="middle" fill="#ff0000" stroke="#000000" stroke-width="2">TEST STROKE</text>
            <text x="384" y="300" font-family="Arial" font-size="32" text-anchor="middle" fill="#00ff00" stroke="#000000" stroke-width="1">Token ${tokenId}</text>
          </svg>
        `
      },
      // Test 5: Texto con tspan
      {
        name: "Con tspan",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="200" font-family="Arial" font-size="48" text-anchor="middle" fill="#ff0000">
              <tspan>TSPAN</tspan>
            </text>
            <text x="384" y="300" font-family="Arial" font-size="32" text-anchor="middle" fill="#00ff00">
              <tspan>Token ${tokenId}</tspan>
            </text>
          </svg>
        `
      },
      // Test 6: Texto con transform
      {
        name: "Con transform",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <g transform="translate(384, 200)">
              <text font-family="Arial" font-size="48" text-anchor="middle" fill="#ff0000">TRANSFORM</text>
            </g>
            <g transform="translate(384, 300)">
              <text font-family="Arial" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
            </g>
          </svg>
        `
      }
    ];

    // Generar todas las imágenes de test
    const results = [];
    
    for (let i = 0; i < testSvgs.length; i++) {
      const test = testSvgs[i];
      console.log(`[debug-svg-text] Probando: ${test.name}`);
      
      try {
        const resvg = new Resvg(Buffer.from(test.svg), {
          fitTo: {
            mode: 'width',
            value: 768
          }
        });
        
        const pngBuffer = resvg.render().asPng();
        results.push({
          name: test.name,
          success: true,
          size: pngBuffer.length
        });
        console.log(`[debug-svg-text] ${test.name}: ÉXITO (${pngBuffer.length} bytes)`);
      } catch (error) {
        results.push({
          name: test.name,
          success: false,
          error: error.message
        });
        console.log(`[debug-svg-text] ${test.name}: ERROR - ${error.message}`);
      }
    }

    // Crear una imagen combinada con todos los tests
    const combinedSvg = `
      <svg width="768" height="${testSvgs.length * 200}" xmlns="http://www.w3.org/2000/svg">
        <rect width="768" height="${testSvgs.length * 200}" fill="#ffffff"/>
        ${testSvgs.map((test, index) => `
          <g transform="translate(0, ${index * 200})">
            <rect width="768" height="200" fill="#f0f0f0" stroke="#ccc"/>
            <text x="384" y="50" font-family="Arial" font-size="24" text-anchor="middle" fill="#333">${test.name}</text>
            <text x="384" y="100" font-family="Arial" font-size="48" text-anchor="middle" fill="#ff0000">TEST ${index + 1}</text>
            <text x="384" y="150" font-family="Arial" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
          </g>
        `).join('')}
      </svg>
    `;

    try {
      const resvg = new Resvg(Buffer.from(combinedSvg), {
        fitTo: {
          mode: 'width',
          value: 768
        }
      });
      
      const combinedPngBuffer = resvg.render().asPng();
      
      console.log(`[debug-svg-text] ===== RESULTADOS =====`);
      results.forEach(result => {
        console.log(`[debug-svg-text] ${result.name}: ${result.success ? 'ÉXITO' : 'ERROR'}`);
      });
      
      // Configurar headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Devolver imagen combinada
      console.log(`[debug-svg-text] ===== DEBUG SVG TEXT FINALIZADO =====`);
      res.status(200).send(combinedPngBuffer);
      
    } catch (error) {
      console.error('[debug-svg-text] Error renderizando imagen combinada:', error);
      res.status(500).json({ 
        error: 'Error renderizando imagen',
        results: results
      });
    }
    
  } catch (error) {
    console.error('[debug-svg-text] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
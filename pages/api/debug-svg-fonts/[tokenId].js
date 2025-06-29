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

    console.log(`[debug-svg-fonts] ===== DEBUG SVG FONTS INICIADO =====`);
    console.log(`[debug-svg-fonts] Token ID: ${tokenId}`);

    // Leer la fuente Roboto para incrustarla
    let robotoFontBase64 = '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf');
    console.log(`[debug-svg-fonts] Ruta fuente: ${fontPath}`);
    console.log(`[debug-svg-fonts] Existe fuente: ${fs.existsSync(fontPath)}`);
    
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath);
      robotoFontBase64 = fontBuffer.toString('base64');
      console.log(`[debug-svg-fonts] Fuente leída, tamaño: ${fontBuffer.length} bytes`);
    } else {
      console.log(`[debug-svg-fonts] Fuente no encontrada, usando placeholder`);
    }

    // Crear múltiples versiones de SVG con diferentes configuraciones de texto
    const testSvgs = [
      // Test 1: Texto básico con Arial (control)
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
      // Test 2: Texto con sans-serif (control)
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
      // Test 3: Texto con múltiples fallbacks (control)
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
      // Test 4: Texto con stroke (control)
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
      // Test 5: Texto con tspan (control)
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
      // Test 6: Texto con transform (control)
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
      },
      // Test 7: Fuente Roboto incrustada (SOLUCIÓN A)
      {
        name: "Roboto incrustada",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <style>
                @font-face {
                  font-family: 'RobotoEmbed';
                  src: url(data:font/ttf;base64,${robotoFontBase64}) format('truetype');
                  font-weight: normal;
                  font-style: normal;
                }
              </style>
            </defs>
            <rect width="768" height="1024" fill="#ffffff"/>
            <text x="384" y="200" font-family="RobotoEmbed" font-size="48" text-anchor="middle" fill="#ff0000">ROBOTO EMBED</text>
            <text x="384" y="300" font-family="RobotoEmbed" font-size="32" text-anchor="middle" fill="#00ff00">Token ${tokenId}</text>
          </svg>
        `
      },
      // Test 8: Texto convertido a paths (SOLUCIÓN B)
      {
        name: "Texto como paths",
        svg: `
          <svg width="768" height="1024" xmlns="http://www.w3.org/2000/svg">
            <rect width="768" height="1024" fill="#ffffff"/>
            <!-- Texto "PATHS TEST" convertido a path -->
            <g transform="translate(384, 200)">
              <path d="M-120,-12 L-120,12 L-108,12 L-108,-12 Z M-96,-12 L-96,12 L-84,12 L-84,-12 Z M-72,-12 L-72,12 L-60,12 L-60,-12 Z M-48,-12 L-48,12 L-36,12 L-36,-12 Z M-24,-12 L-24,12 L-12,12 L-12,-12 Z M0,-12 L0,12 L12,12 L12,-12 Z M24,-12 L24,12 L36,12 L36,-12 Z M48,-12 L48,12 L60,12 L60,-12 Z M72,-12 L72,12 L84,12 L84,-12 Z M96,-12 L96,12 L108,12 L108,-12 Z M120,-12 L120,12 L132,12 L132,-12 Z" fill="#ff0000"/>
            </g>
            <!-- Texto "Token X" convertido a path -->
            <g transform="translate(384, 300)">
              <path d="M-80,-8 L-80,8 L-68,8 L-68,-8 Z M-64,-8 L-64,8 L-52,8 L-52,-8 Z M-48,-8 L-48,8 L-36,8 L-36,-8 Z M-32,-8 L-32,8 L-20,8 L-20,-8 Z M-16,-8 L-16,8 L-4,8 L-4,-8 Z M0,-8 L0,8 L12,8 L12,-8 Z M16,-8 L16,8 L28,8 L28,-8 Z M32,-8 L32,8 L44,8 L44,-8 Z M48,-8 L48,8 L60,8 L60,-8 Z M64,-8 L64,8 L76,8 L76,-8 Z" fill="#00ff00"/>
            </g>
          </svg>
        `
      }
    ];

    // Generar todas las imágenes de test
    const results = [];
    
    for (let i = 0; i < testSvgs.length; i++) {
      const test = testSvgs[i];
      console.log(`[debug-svg-fonts] Probando: ${test.name}`);
      
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
        console.log(`[debug-svg-fonts] ${test.name}: ÉXITO (${pngBuffer.length} bytes)`);
      } catch (error) {
        results.push({
          name: test.name,
          success: false,
          error: error.message
        });
        console.log(`[debug-svg-fonts] ${test.name}: ERROR - ${error.message}`);
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
      
      console.log(`[debug-svg-fonts] ===== RESULTADOS =====`);
      results.forEach(result => {
        console.log(`[debug-svg-fonts] ${result.name}: ${result.success ? 'ÉXITO' : 'ERROR'}`);
      });
      
      // Configurar headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Devolver imagen combinada
      console.log(`[debug-svg-fonts] ===== DEBUG SVG FONTS FINALIZADO =====`);
      res.status(200).send(combinedPngBuffer);
      
    } catch (error) {
      console.error('[debug-svg-fonts] Error renderizando imagen combinada:', error);
      res.status(500).json({ 
        error: 'Error renderizando imagen',
        results: results
      });
    }
    
  } catch (error) {
    console.error('[debug-svg-fonts] Error general:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
} 
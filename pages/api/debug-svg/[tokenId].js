import { textToSVGElement, linesToSVG } from '../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.svg')) {
      tokenId = tokenId.replace('.svg', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[debug-svg] ===== DEBUG SVG INICIADO =====`);
    console.log(`[debug-svg] Token ID: ${tokenId}`);

    // Path generado a partir de texto
    const pathElement = textToSVGElement('PRUEBA', {
      x: 200,
      y: 120,
      fontSize: 64,
      fill: '#ff0000'
    });

    // Path generado a partir de texto más pequeño
    const pathElementSmall = textToSVGElement('small', {
      x: 200,
      y: 200,
      fontSize: 32,
      fill: '#00aa00'
    });

    // Path generado a partir de texto más grande
    const pathElementBig = textToSVGElement('BIG', {
      x: 200,
      y: 260,
      fontSize: 80,
      fill: '#0000ff'
    });

    // Texto normal para comparar
    const textElement = `<text x="200" y="120" font-family="Arial" font-size="64" text-anchor="middle" fill="#888888">PRUEBA</text>`;
    const textElementSmall = `<text x="200" y="200" font-family="Arial" font-size="32" text-anchor="middle" fill="#888888">small</text>`;
    const textElementBig = `<text x="200" y="260" font-family="Arial" font-size="80" text-anchor="middle" fill="#888888">BIG</text>`;

    // SVG de prueba
    const debugSvg = `
      <svg width="400" height="320" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="320" fill="#fff"/>
        <text x="200" y="40" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Debug: Path vs Text</text>
        <!-- Path generado -->
        ${pathElement}
        ${pathElementSmall}
        ${pathElementBig}
        <!-- Texto normal -->
        ${textElement}
        ${textElementSmall}
        ${textElementBig}
      </svg>
    `;

    console.log(`[debug-svg] Debug SVG:`, debugSvg);
    console.log(`[debug-svg] Debug SVG length:`, debugSvg.length);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(debugSvg);
    
  } catch (error) {
    console.error('[debug-svg] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 
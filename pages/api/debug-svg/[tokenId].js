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

    // Test simple: solo un elemento
    const simpleElement = textToSVGElement('TEST', {
      x: 100,
      y: 100,
      fontSize: 48,
      fill: '#ff0000'
    });

    console.log(`[debug-svg] Simple element:`, simpleElement);

    // Test simple: solo líneas
    const simpleLines = linesToSVG([
      {
        text: 'LINE 1',
        x: 100,
        y: 200,
        fontSize: 32,
        fill: '#00ff00'
      }
    ]);

    console.log(`[debug-svg] Simple lines:`, simpleLines);

    // SVG simple para debug
    const debugSvg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#ffffff"/>
        <text x="200" y="50" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Debug SVG</text>
        ${simpleElement}
        ${simpleLines}
      </svg>
    `;

    console.log(`[debug-svg] Debug SVG:`, debugSvg);
    console.log(`[debug-svg] Debug SVG length:`, debugSvg.length);

    // Devolver el SVG como texto para inspeccionar
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(debugSvg);
    
  } catch (error) {
    console.error('[debug-svg] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 
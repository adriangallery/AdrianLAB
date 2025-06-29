import { textToSVGElement, textToPath } from '../../../lib/text-to-svg.js';

export default async function handler(req, res) {
  try {
    let { tokenId } = req.query;
    
    if (tokenId && tokenId.endsWith('.svg')) {
      tokenId = tokenId.replace('.svg', '');
    }
    
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[debug-paths] ===== DEBUG PATHS INICIADO =====`);
    console.log(`[debug-paths] Token ID: ${tokenId}`);

    // Obtener solo el path data
    const pathData = textToPath('TEST', {
      fontSize: 48,
      fill: '#ff0000'
    });

    console.log(`[debug-paths] Path data:`, pathData);

    // Crear SVG simple con el path
    const debugSvg = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#ffffff"/>
        <text x="200" y="40" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">Debug Path Data</text>
        
        <!-- Path directo -->
        <path d="${pathData}" fill="#ff0000" stroke="#000000" stroke-width="1"/>
        
        <!-- Path con transformación -->
        <g transform="translate(200, 150)">
          <path d="${pathData}" fill="#00ff00" stroke="#000000" stroke-width="1"/>
        </g>
        
        <!-- Path con escala -->
        <g transform="translate(200, 250) scale(0.5)">
          <path d="${pathData}" fill="#0000ff" stroke="#000000" stroke-width="1"/>
        </g>
        
        <!-- Texto normal para comparar -->
        <text x="200" y="100" font-family="Arial" font-size="48" text-anchor="middle" fill="#888888">TEST</text>
      </svg>
    `;

    console.log(`[debug-paths] SVG generado:`, debugSvg);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(debugSvg);
    
  } catch (error) {
    console.error('[debug-paths] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 
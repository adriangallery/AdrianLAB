import { AdrianZeroRenderer } from '../../../../lib/renderers/adrianzero-renderer.js';

const LAMBO_DEFAULT = 'Lambo_Variant_Yellow';

export default async function handler(req, res) {
  // Configurar CORS - Permitir múltiples orígenes
  const allowedOrigins = [
    'https://adrianzero.com',
    'https://adrianpunks.com',
    'https://adriangallery.com',
    'https://opensea.io',
    'https://testnets.opensea.io',
    'https://rarible.com',
    'https://looksrare.org',
    'https://x2y2.io',
    'https://blur.io',
    'https://magiceden.io',
    'https://sudoswap.xyz',
    'https://reservoir.tools',
    'https://nftx.io',
    'https://element.market',
    'https://tensor.trade',
    'https://okx.com',
    'https://binance.com',
    'https://coinbase.com'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Para requests sin origin (como imágenes directas) o orígenes no listados
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Token y lambo
    const { tokenId, lambo } = req.query;
    const cleanTokenId = tokenId.replace('.png', '');
    if (!cleanTokenId || isNaN(parseInt(cleanTokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }

    console.log(`[lambo-render] 🚗 Generando lambo ${lambo || LAMBO_DEFAULT} para token ${cleanTokenId}`);

    // Usar AdrianZeroRenderer con modo lambo
    const renderer = new AdrianZeroRenderer();
    const pngBuffer = await renderer.generatePNGForLambo(cleanTokenId, {
      lambo: lambo || LAMBO_DEFAULT,
      canvasWidth: 1500,
      canvasHeight: 500
    });

    // Configurar headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Version', 'LAMBO-ADRIANZERO-RENDERER');
    res.setHeader('X-Lambo-Color', lambo || LAMBO_DEFAULT);
    
    console.log(`[lambo-render] 🚗 Lambo ${lambo || LAMBO_DEFAULT} generado exitosamente para token ${cleanTokenId}`);
    res.status(200).send(pngBuffer);
    
  } catch (error) {
    console.error('[lambo-render] Error:', error);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
} 
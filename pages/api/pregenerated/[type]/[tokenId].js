import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { type, tokenId } = req.query;
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extraer traits de query params si existen
    const traits = [];
    if (Array.isArray(req.query.trait)) {
      traits.push(...req.query.trait);
    } else if (req.query.trait) {
      traits.push(req.query.trait);
    }

    // Construir ruta del archivo
    let filePath;
    if (type === 'custom' && traits.length > 0) {
      const traitsKey = traits.sort((a, b) => parseInt(a) - parseInt(b)).join('-');
      filePath = path.join(process.cwd(), 'public', 'pregenerated', 'adrianzero', 'custom', 'popular', `${tokenId}_${traitsKey}.png`);
    } else if (type === 'skin') {
      filePath = path.join(process.cwd(), 'public', 'pregenerated', 'adrianzero', 'skins', `${tokenId}.png`);
    } else {
      return res.status(400).json({ error: 'Invalid type or missing traits for custom render' });
    }

    // Verificar si el archivo existe
    if (!fs.existsSync(filePath)) {
      console.log(`[pregenerated] File not found: ${filePath}`);
      return res.status(404).json({ error: 'Pregenerated file not found' });
    }

    // Leer y servir el archivo
    const imageBuffer = fs.readFileSync(filePath);
    
    console.log(`[pregenerated] ✅ Serving: ${filePath}`);
    
    // Headers optimizados para archivos pregenerados
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 días
    res.setHeader('X-Cache', 'PREGEN-HIT');
    res.setHeader('X-Version', 'ADRIANZERO-PREGENERATED');
    res.setHeader('X-Source', 'STATIC-FILE');
    res.setHeader('X-File-Path', filePath.replace(process.cwd(), ''));
    
    if (traits.length > 0) {
      res.setHeader('X-Traits', traits.join(','));
    }
    
    return res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('[pregenerated] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
} 
import { createCanvas, loadImage } from 'canvas';
import { getAssetInfo } from '../../../lib/blockchain.js';
import { getCachedResult, setCachedResult } from '../../../lib/cache.js';
import { generateTraitHash } from '../../../lib/render-hash.js';
import { fileExistsInGitHubTrait, getGitHubFileUrlTrait, uploadFileToGitHubTrait } from '../../../lib/github-storage.js';
import path from 'path';
import fs from 'fs';

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

  const { traitId } = req.query;
  
  if (!traitId || isNaN(traitId)) {
    return res.status(400).json({ error: 'Invalid trait ID' });
  }
  
  const cacheKey = `trait_${traitId}`;
  
  // Check cache
  const cachedImage = getCachedResult(cacheKey);
  if (cachedImage) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=7200'); // 2 hours
    res.setHeader('X-Cache', 'HIT');
    return res.send(cachedImage);
  }
  
  try {
    // Generar hash único para el trait
    const traitHash = generateTraitHash(traitId);
    console.log(`[trait] 🔐 Hash generado para trait ${traitId}: ${traitHash}`);
    
    // Verificar si existe en GitHub
    const existsInGitHub = await fileExistsInGitHubTrait(traitId, traitHash);
    if (existsInGitHub) {
      console.log(`[trait] ✅ Trait ${traitId} existe en GitHub, descargando...`);
      const githubUrl = getGitHubFileUrlTrait(traitId, traitHash);
      
      try {
        const response = await fetch(githubUrl);
        if (response.ok) {
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          
          // Cachear el resultado
          setCachedResult(cacheKey, imageBuffer, 7200);
          
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=7200');
          res.setHeader('X-Cache', 'GITHUB');
          res.setHeader('X-Source', 'github');
          return res.send(imageBuffer);
        }
      } catch (fetchError) {
        console.error(`[trait] ❌ Error descargando desde GitHub:`, fetchError.message);
        // Continuar con renderizado normal si falla la descarga
      }
    } else {
      console.log(`[trait] 📤 Trait ${traitId} no existe en GitHub - Se renderizará y subirá`);
    }
    
    // Get trait info from blockchain
    const assetInfo = await getAssetInfo(traitId);
    if (!assetInfo) {
      return res.status(404).json({ error: 'Trait not found' });
    }
    
    // Create canvas
    const canvas = createCanvas(500, 500); // Smaller for individual traits
    const ctx = canvas.getContext('2d');
    
    // Clear with transparent background
    ctx.clearRect(0, 0, 500, 500);
    
    // Look for the trait SVG file: public/traits/{CATEGORY}/{traitId}.svg
    const svgPath = path.join(process.cwd(), 'public', 'traits', assetInfo.category, `${traitId}.svg`);
    // Also try fileName if available: public/traits/{CATEGORY}/{fileName}.svg
    const fileNamePath = assetInfo.fileName
      ? path.join(process.cwd(), 'public', 'traits', assetInfo.category, `${assetInfo.fileName}.svg`)
      : null;

    const resolvedPath = fs.existsSync(svgPath) ? svgPath :
      (fileNamePath && fs.existsSync(fileNamePath)) ? fileNamePath : null;

    if (resolvedPath) {
      const svgData = fs.readFileSync(resolvedPath, 'utf8');
      // Convert SVG to data URL for canvas loading
      const svgBuffer = Buffer.from(svgData);
      const traitImage = await loadImage(svgBuffer);
      ctx.drawImage(traitImage, 0, 0, 500, 500);
    } else {
      // Fallback: colored rectangle with trait name
      ctx.fillStyle = '#2D3748';
      ctx.fillRect(0, 0, 500, 500);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(assetInfo.name || `Trait #${traitId}`, 250, 250);
      ctx.font = '16px Arial';
      ctx.fillText(`${assetInfo.category} #${traitId}`, 250, 280);
    }
    
    const buffer = canvas.toBuffer('image/png');
    
    // Subir a GitHub
    console.log(`[trait] 🚀 Iniciando subida a GitHub para trait ${traitId} (hash: ${traitHash})`);
    await uploadFileToGitHubTrait(traitId, buffer, traitHash);
    
    // Cache result
    setCachedResult(cacheKey, buffer, 7200); // 2 hours
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=7200');
    res.setHeader('X-Cache', 'MISS');
    res.send(buffer);
    
  } catch (error) {
    console.error('Error rendering trait:', error);
    res.status(500).json({ error: 'Failed to render trait' });
  }
} 
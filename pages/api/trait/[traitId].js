import { createCanvas, loadImage } from 'canvas';
import { getAssetInfo } from '../../../lib/blockchain.js';
import { getCachedResult, setCachedResult } from '../../../lib/cache.js';
import path from 'path';
import fs from 'fs';

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://adrianpunks.com');
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
    
    // For this test version, we map names to existing files
    // In the test naming model, "Blue Sky" maps to "blue.png"
    let fileName;
    if (assetInfo.name.includes("Blue")) fileName = "blue.png";
    else if (assetInfo.name.includes("Green")) fileName = "green.png";
    else if (assetInfo.name.includes("Red")) fileName = "red.png";
    else if (assetInfo.name.includes("Normal")) fileName = "normal.png";
    else if (assetInfo.name.includes("Rare")) fileName = "rare.png";
    else if (assetInfo.name.includes("Cool")) fileName = "cool.png";
    else if (assetInfo.name.includes("Laser")) fileName = "laser.png";
    else if (assetInfo.name.includes("Happy")) fileName = "smile.png";
    else if (assetInfo.name.includes("Serious")) fileName = "serious.png";
    else if (assetInfo.name.includes("Surprised")) fileName = "surprised.png";
    else if (assetInfo.name.includes("Hat")) fileName = "hat.png";
    else if (assetInfo.name.includes("Cap")) fileName = "cap.png";
    else if (assetInfo.name.includes("Lab")) fileName = "lab_coat.png";
    else if (assetInfo.name.includes("Business")) fileName = "suit.png";
    else if (assetInfo.name.includes("Casual")) fileName = "casual.png";
    else if (assetInfo.name.includes("Smart")) fileName = "glasses.png";
    else if (assetInfo.name.includes("Luxury")) fileName = "watch.png";
    else if (assetInfo.name.includes("None")) fileName = "none.png";
    else fileName = "normal.png"; // default
    
    const imagePath = path.join(process.cwd(), 'public', 'traits', assetInfo.category, fileName);
    
    if (fs.existsSync(imagePath)) {
      const traitImage = await loadImage(imagePath);
      ctx.drawImage(traitImage, 0, 0, 500, 500);
      
      // Add trait name as overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 450, 500, 50);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${assetInfo.name} #${traitId}`, 250, 480);
    } else {
      // Fallback: create a colored rectangle with trait name
      ctx.fillStyle = '#2D3748';
      ctx.fillRect(0, 0, 500, 500);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(assetInfo.name, 250, 250);
      ctx.fillText(`#${traitId}`, 250, 280);
    }
    
    const buffer = canvas.toBuffer('image/png');
    
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
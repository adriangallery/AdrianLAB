// API endpoint for rendering tokens by tokenId
import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage, Image } from 'canvas';
import { getRawTokenMetadata } from '../../../lib/blockchain.js';
import { Resvg } from '@resvg/resvg-js';

export default async function handler(req, res) {
  try {
    // Extract tokenId, removing .png extension if present
    let { tokenId } = req.query;
    
    // Remove .png extension if present
    if (tokenId && tokenId.endsWith('.png')) {
      tokenId = tokenId.replace('.png', '');
    }
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    // Get token data from blockchain
    let tokenData;
    try {
      tokenData = await getRawTokenMetadata(parseInt(tokenId));
    } catch (error) {
      console.error(`Error getting token data ${tokenId}:`, error);
      // If there's an error getting the data, use the fallback SVG
      return renderFallbackSVG(res, tokenId);
    }
    
    // Create a canvas for the image
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Configure for high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1000, 1000);
    
    // Draw skin layer if skinId > 0
    if (tokenData.skinId > 0) {
      const skinPath = path.join(process.cwd(), 'public', 'traits', 'SKIN', `${tokenData.skinId}.svg`);
      
      if (fs.existsSync(skinPath)) {
        try {
          // Read the SVG file
          const svgContent = fs.readFileSync(skinPath, 'utf8');
          
          // Create a new canvas for the SVG rendering
          const svgCanvas = createCanvas(1000, 1000);
          const svgCtx = svgCanvas.getContext('2d');
          
          // Parse the SVG string
          const svg = new Resvg(svgContent, {
            fitTo: {
              mode: 'width',
              value: 1000
            },
            font: {
              loadSystemFonts: true
            },
            imageRendering: 1, // High quality
            logLevel: 'error'
          });
          
          // Render the SVG to a PNG buffer
          const svgPngBuffer = svg.render().asPng();
          
          // Load the PNG buffer as an image
          const svgImage = new Image();
          svgImage.src = svgPngBuffer;
          
          // Draw the SVG image onto the canvas
          svgCtx.imageSmoothingEnabled = true;
          svgCtx.imageSmoothingQuality = 'high';
          svgCtx.drawImage(svgImage, 0, 0, 1000, 1000);
          
          // Now draw the rendered SVG onto the main canvas
          ctx.drawImage(svgCanvas, 0, 0, 1000, 1000);
        } catch (svgError) {
          console.error(`Error processing SVG: ${skinPath}`, svgError);
        }
      }
    }
    
    // Convert to PNG buffer with high quality settings
    const buffer = canvas.toBuffer('image/png', { compressionLevel: 6, quality: 1.0 });
    
    // Send the image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error rendering token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function renderFallbackSVG(res, tokenId) {
  // Default or fallback, return SVG
  const svg = `
  <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="24" fill="black" text-anchor="middle">
      BareAdrian #${tokenId}
    </text>
    <text x="50%" y="60%" font-family="Arial" font-size="16" fill="black" text-anchor="middle">
      API in development
    </text>
  </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.status(200).send(svg);
}
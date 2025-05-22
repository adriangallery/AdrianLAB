// API endpoint for rendering tokens by tokenId
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { getTokenTraits } from '../../../lib/blockchain.js';

export default async function handler(req, res) {
  try {
    const { tokenId } = req.query;
    
    // Verify that tokenId is valid
    if (!tokenId || isNaN(parseInt(tokenId))) {
      return res.status(400).json({ error: 'Invalid token ID' });
    }
    
    // Get token data from blockchain (simulated)
    let tokenData;
    try {
      tokenData = await getTokenTraits(parseInt(tokenId));
    } catch (error) {
      console.error(`Error getting token data ${tokenId}:`, error);
      // If there's an error getting the data, use the fallback SVG
      return renderFallbackSVG(res, tokenId);
    }
    
    // Check if we can use PNG images
    const traitsFolderExists = fs.existsSync(path.join(process.cwd(), 'public', 'traits'));
    
    if (traitsFolderExists) {
      try {
        // Create a canvas for the image
        const canvas = createCanvas(1000, 1000);
        const ctx = canvas.getContext('2d');
        
        // Draw each layer in order according to token traits
        for (let i = 0; i < tokenData.categories.length; i++) {
          const category = tokenData.categories[i];
          const traitId = tokenData.traitIds[i];
          
          // Only draw if traitId is greater than 0 (0 = no trait)
          if (traitId > 0) {
            await drawLayer(ctx, category, traitId, tokenData);
          }
        }
        
        // Apply mutation effect if it exists
        if (tokenData.mutationLevel > 0) {
          await applyMutationEffect(ctx, tokenData.mutationLevel);
        }
        
        // Convert to PNG buffer
        const buffer = canvas.toBuffer('image/png');
        
        // Send the image
        res.setHeader('Content-Type', 'image/png');
        return res.status(200).send(buffer);
      } catch (error) {
        console.error('Error rendering PNG:', error);
        // If it fails, return to the fallback SVG
        return renderFallbackSVG(res, tokenId);
      }
    } else {
      return renderFallbackSVG(res, tokenId);
    }
  } catch (error) {
    console.error('Error rendering token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function drawLayer(ctx, category, traitId, tokenData) {
  try {
    let imagePath;
    
    // If it's the BASE layer, use the specific body type
    if (category === "BASE") {
      if (tokenData.bodyTypeId > 0) {
        // Use specific body type image
        imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', `${tokenData.bodyTypeName.toLowerCase()}.png`);
        
        // Fallback to image by ID if it doesn't exist by name
        if (!fs.existsSync(imagePath)) {
          imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', `body_${tokenData.bodyTypeId}.png`);
        }
      } else {
        // Basic body type
        imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', 'basic.png');
      }
    } else {
      // For other layers, use the normal system
      imagePath = path.join(process.cwd(), 'public', 'traits', category, `${traitId}.png`);
    }
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`Image not found: ${imagePath}`);
      return;
    }
    
    const image = await loadImage(imagePath);
    ctx.drawImage(image, 0, 0, 1000, 1000);
    
  } catch (error) {
    console.error(`Error loading layer ${category}/${traitId}:`, error);
  }
}

async function applyMutationEffect(ctx, mutationLevel) {
  try {
    let mutationFile;
    
    switch (mutationLevel) {
      case 1: // MILD
        mutationFile = 'mild.png';
        break;
      case 2: // MODERATE  
        mutationFile = 'moderate.png';
        break;
      case 3: // SEVERE
        mutationFile = 'severe.png';
        break;
      default:
        return;
    }
    
    const mutationPath = path.join(process.cwd(), 'public', 'traits', 'MUTATION', mutationFile);
    
    if (fs.existsSync(mutationPath)) {
      const mutationOverlay = await loadImage(mutationPath);
      ctx.drawImage(mutationOverlay, 0, 0, 1000, 1000);
    }
    
  } catch (error) {
    console.error('Error applying mutation effect:', error);
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
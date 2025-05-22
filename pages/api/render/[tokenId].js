// API endpoint for rendering tokens by tokenId
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { getTokenTraits } from '../../../lib/blockchain.js';

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
        
        // Special handling for token 1 to showcase transparency
        if (parseInt(tokenId) === 1) {
          // Draw a checkered background to demonstrate transparency
          ctx.fillStyle = '#F0F0F0';
          ctx.fillRect(0, 0, 1000, 1000);
          
          // Draw a grid pattern to make transparency obvious
          ctx.strokeStyle = '#E0E0E0';
          ctx.lineWidth = 2;
          
          for (let i = 0; i < 1000; i += 50) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(1000, i);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 1000);
            ctx.stroke();
          }
          
          // Alternating pattern of darker squares
          for (let y = 0; y < 1000; y += 100) {
            for (let x = 0; x < 1000; x += 100) {
              if ((x + y) % 200 === 0) {
                ctx.fillStyle = '#E0E0E0';
                ctx.fillRect(x, y, 50, 50);
                ctx.fillRect(x + 50, y + 50, 50, 50);
              }
            }
          }
        } else {
          // For other tokens, use a solid white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 1000, 1000);
        }
        
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
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
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
        // Use body type ID directly as filename
        imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', `${tokenData.bodyTypeId}.png`);
      } else {
        // Basic body type (ID 0)
        imagePath = path.join(process.cwd(), 'public', 'traits', 'BASE', '0.png');
      }
    } else {
      // For other layers, use trait ID directly as filename
      imagePath = path.join(process.cwd(), 'public', 'traits', category, `${traitId}.png`);
    }
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.warn(`Image not found: ${imagePath}`);
      // If the image doesn't exist, try to create a basic representation
      if (tokenData.tokenId === 1) {
        // For token 1, use colored placeholder shapes to ensure visibility
        if (category === 'BACKGROUND') {
          // Create a semi-transparent blue background
          const gradient = ctx.createRadialGradient(500, 500, 0, 500, 500, 800);
          gradient.addColorStop(0, 'rgba(0, 0, 255, 0.4)');
          gradient.addColorStop(1, 'rgba(0, 0, 255, 0.1)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 1000, 1000);
          
          // Add blue stripes to make it visually distinct
          ctx.strokeStyle = 'rgba(0, 0, 200, 0.5)';
          ctx.lineWidth = 3;
          for (let i = 0; i < 1000; i += 80) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 1000);
            ctx.stroke();
          }
        } else if (category === 'MOUTH') {
          // Draw a simple red smile
          ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.beginPath();
          ctx.arc(500, 600, 150, 0.1 * Math.PI, 0.9 * Math.PI, false);
          ctx.lineWidth = 15;
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
          ctx.stroke();
        } else if (category === 'BASE') {
          // Draw a simple green silhouette
          ctx.fillStyle = 'rgba(0, 180, 0, 0.6)';
          // Head
          ctx.beginPath();
          ctx.arc(500, 300, 150, 0, 2 * Math.PI);
          ctx.fill();
          // Body
          ctx.beginPath();
          ctx.moveTo(350, 450);
          ctx.lineTo(650, 450);
          ctx.lineTo(600, 800);
          ctx.lineTo(400, 800);
          ctx.closePath();
          ctx.fill();
        }
      }
      return;
    }
    
    // Load and draw the image
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